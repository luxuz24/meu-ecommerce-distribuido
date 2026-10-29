import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useTelemetry } from '../../context/TelemetryContext';
import { DevOnly } from '../telemetry/DevTelemetry';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const { totalItems } = useCart();
  const {
    isDevMode,
    toggleDevMode,
    userServiceHealth,
    catalogServiceHealth,
  } = useTelemetry();

  const currentSectionLabel = () => {
    if (location.pathname.startsWith('/admin')) return 'Admin Products';
    if (location.pathname.startsWith('/orders')) return 'Pedidos & Saga';
    if (location.pathname.startsWith('/auth')) return 'Auth Cluster';
    if (location.pathname.startsWith('/profile')) return 'Meu Perfil';
    if (location.pathname.startsWith('/products/')) return 'Detalhe do Produto';
    return 'Catálogo';
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-margin-sm py-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="font-headline-sm text-headline-sm tracking-tight text-on-surface hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-primary text-[22px]">
                  deployed_code
                </span>
                <span>MicroStore</span>
              </Link>
              <DevOnly>
                <span className="font-code-sm text-code-sm bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-lg">
                  v1.0 Distributed
                </span>
              </DevOnly>
            </div>

            {/* Desktop Nav + Dev Mode Toggle + Profile */}
            <div className="flex items-center gap-2">
              <nav className="hidden md:flex items-center gap-1 mr-2">
                <Link
                  to="/"
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
                    location.pathname === '/'
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Catálogo
                </Link>
                <Link
                  to="/orders"
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1.5 ${
                    location.pathname.startsWith('/orders')
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span>Pedidos</span>
                  {totalItems > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-tertiary text-on-tertiary font-code-sm text-code-sm">
                      {totalItems}
                    </span>
                  )}
                </Link>
                <Link
                  to="/admin/products"
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Admin Produtos
                </Link>
                <Link
                  to="/architecture"
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1.5 ${
                    location.pathname === '/architecture'
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">account_tree</span>
                  <span>Arquitetura Viva</span>
                </Link>
                <Link
                  to={user ? '/profile' : '/auth'}
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
                    location.pathname.startsWith('/auth') ||
                    location.pathname.startsWith('/profile')
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {user ? `Perfil (${user.name.split(' ')[0]})` : 'Entrar / Criar Conta'}
                </Link>
              </nav>

              {/* Toggle between Stitch Dev Telemetry Mode and Clean User Mode */}
              <button
                type="button"
                onClick={toggleDevMode}
                title="Alternar entre Modo Desenvolvimento (com telemetria e testes) e Modo Loja Limpa (visão final do usuário)"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-code-sm text-code-sm transition-all border ${
                  isDevMode
                    ? 'bg-inverse-surface text-inverse-on-surface border-inverse-surface'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isDevMode ? 'terminal' : 'visibility'}
                </span>
                <span>{isDevMode ? 'Dev Telemetry: ON' : 'Modo Limpo'}</span>
              </button>

              <Link
                to={user ? '/profile' : '/auth'}
                aria-label="Perfil ou Login"
                className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md font-semibold shadow-sm hover:opacity-90 transition-opacity"
              >
                {user ? (
                  user.name.slice(0, 2).toUpperCase()
                ) : (
                  <span className="material-symbols-outlined text-[18px]">
                    person
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Second Bar: Microservice Live Health Pills (Only in Dev Mode) */}
          <DevOnly>
            <div className="flex items-center justify-between gap-space-sm pt-0.5 border-t border-surface-container">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div className="inline-flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-lg">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      userServiceHealth.online
                        ? 'bg-tertiary-fixed-dim animate-pulse'
                        : 'bg-error'
                    }`}
                  />
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    user-service · gateway :8080
                    {userServiceHealth.latencyMs !== null
                      ? ` (${userServiceHealth.latencyMs}ms)`
                      : userServiceHealth.online
                        ? ''
                        : ' [OFFLINE]'}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-lg">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      catalogServiceHealth.online
                        ? 'bg-tertiary-fixed-dim animate-pulse'
                        : 'bg-error'
                    }`}
                  />
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    catalog-service · gateway :8080
                    {catalogServiceHealth.latencyMs !== null
                      ? ` (${catalogServiceHealth.latencyMs}ms)`
                      : catalogServiceHealth.online
                        ? ''
                        : ' [OFFLINE]'}
                  </span>
                </div>
              </div>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider truncate">
                {currentSectionLabel()}
              </span>
            </div>
          </DevOnly>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 w-full max-w-6xl mx-auto px-margin-sm pb-24 ${
          isDevMode ? 'pt-28' : 'pt-20'
        }`}
      >
        {children}
      </main>

      {/* Bottom Navigation (Mobile & Quick Switch) */}
      <nav className="fixed bottom-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] border-t border-surface-container">
        <div className="max-w-xl mx-auto h-16 flex items-center justify-around px-margin-sm">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
              location.pathname === '/' ||
              location.pathname.startsWith('/products/')
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              inventory_2
            </span>
            <span className="font-label-md text-label-md mt-0.5">Catálogo</span>
          </Link>

          <Link
            to="/orders"
            className={`relative flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
              location.pathname.startsWith('/orders')
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              shopping_bag
            </span>
            {totalItems > 0 && (
              <span className="absolute top-1 right-2 px-1.5 rounded-full bg-tertiary text-on-tertiary font-code-sm text-[10px]">
                {totalItems}
              </span>
            )}
            <span className="font-label-md text-label-md mt-0.5">Pedidos</span>
          </Link>

          <Link
            to="/admin/products"
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
              location.pathname.startsWith('/admin')
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              terminal
            </span>
            <span className="font-label-md text-label-md mt-0.5">Admin</span>
          </Link>

          <Link
            to="/architecture"
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
              location.pathname === '/architecture'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              account_tree
            </span>
            <span className="font-label-md text-label-md mt-0.5">Arquitetura</span>
          </Link>

          <Link
            to="/auth"
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
              location.pathname.startsWith('/auth')
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">login</span>
            <span className="font-label-md text-label-md mt-0.5">Auth</span>
          </Link>

          <Link
            to="/profile"
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
              location.pathname.startsWith('/profile')
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              account_circle
            </span>
            <span className="font-label-md text-label-md mt-0.5">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
};
