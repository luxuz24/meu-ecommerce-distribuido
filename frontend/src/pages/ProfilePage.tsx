import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DevOnly,
  EndpointBar,
  JsonInspectorDrawer,
} from '../components/telemetry/DevTelemetry';
import { useAuth } from '../context/AuthContext';
import type { ApiTelemetryRecord } from '../domain/types';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, tokenJwt, lastAuthTelemetry, revalidateProfile, logout, isLoading } =
    useAuth();

  const [telemetry, setTelemetry] = useState<ApiTelemetryRecord | null>(
    lastAuthTelemetry
  );
  const [copiedUuid, setCopiedUuid] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [decodedClaims, setDecodedClaims] = useState<string | null>(null);

  if (!user || !tokenJwt) {
    return (
      <div className="max-w-xl mx-auto flex flex-col gap-space-md bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container-high text-center">
        <span className="material-symbols-outlined text-[42px] text-primary mx-auto">
          lock
        </span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Sessão não autenticada
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Faça login ou crie uma conta para acessar seu perfil e validar a rota
          protegida <code>GET /users/me</code> com Bearer Token JWT.
        </p>
        <div className="flex justify-center pt-2">
          <Link
            to="/auth"
            className="px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg shadow-sm"
          >
            Ir para Login / Cadastro
          </Link>
        </div>
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleRevalidate = async () => {
    const res = await revalidateProfile();
    if (res) {
      setTelemetry(res);
    }
  };

  const handleDecodeJwt = () => {
    if (decodedClaims) {
      setDecodedClaims(null);
      return;
    }
    try {
      const parts = tokenJwt.split('.');
      if (parts[1]) {
        const decoded = JSON.parse(atob(parts[1])) as unknown;
        setDecodedClaims(JSON.stringify(decoded, null, 2));
      }
    } catch {
      setDecodedClaims('{"error": "Unable to decode token"}');
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col w-full gap-space-md">
      {/* Header Context */}
      <DevOnly>
        <section className="flex flex-col gap-space-xs bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between gap-space-xs text-on-surface-variant font-code-sm text-code-sm">
            <div className="flex items-center gap-1.5 truncate">
              <span>Início</span>
              <span>/</span>
              <span>Usuário</span>
              <span>/</span>
              <span className="text-primary font-medium">/profile</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-tertiary">
                lock_clock
              </span>
              <span>GET /users/me</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 overflow-hidden">
            <span className="material-symbols-outlined text-[14px] text-primary shrink-0">
              key
            </span>
            <p className="font-code-sm text-code-sm text-on-surface-variant truncate">
              Authorization: Bearer{' '}
              <span className="text-primary font-medium">
                {tokenJwt.slice(0, 24)}...
              </span>
            </p>
          </div>
        </section>
      </DevOnly>

      {/* User Entity Card */}
      <section className="flex flex-col bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high gap-space-md">
        <div className="flex items-start justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm">
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-container-lowest flex items-center justify-center p-0.5">
                <span className="w-full h-full rounded-full bg-tertiary flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-tertiary text-[10px]">
                    check
                  </span>
                </span>
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">
                  {user.name}
                </h2>
                <span
                  className="material-symbols-outlined text-primary text-[18px]"
                  title="Verificado"
                >
                  verified
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {user.email}
              </p>
              <div className="inline-flex items-center gap-1 mt-1 text-on-secondary-container bg-secondary-container/50 px-1.5 py-0.5 rounded text-[11px] font-label-md font-medium w-fit">
                <span className="material-symbols-outlined text-[13px]">
                  verified_user
                </span>
                <span>CLIENTE AUTENTICADO</span>
              </div>
            </div>
          </div>
        </div>

        {/* User UUID */}
        <div className="flex flex-col gap-1 bg-surface-container-low p-2.5 rounded-lg">
          <div className="flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm">
            <span className="uppercase tracking-wider">User ID (UUID)</span>
            <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant">
              PostgreSQL
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-code-sm text-code-sm text-on-surface truncate select-all">
              {user.id}
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(user.id);
                setCopiedUuid(true);
                setTimeout(() => setCopiedUuid(false), 1500);
              }}
              className="shrink-0 p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors flex items-center"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiedUuid ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Developer / QA Session Diagnostic Panel (Dev Mode Only) */}
      <DevOnly>
        <section className="flex flex-col bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high gap-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                monitor_heart
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Diagnóstico de Sessão JWT
              </h3>
            </div>
            <span className="font-code-sm text-code-sm bg-tertiary-container/20 text-tertiary px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              200 OK (HS256)
            </span>
          </div>

          <EndpointBar method="GET" endpoint="/users/me" badgeText="Bearer Auth" />

          {/* Token Preview */}
          <div className="flex flex-col gap-1.5 bg-surface-container-low p-2.5 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">
                JWT Bearer Token
              </span>
              <span className="font-code-sm text-code-sm text-primary font-medium">
                1h TTL
              </span>
            </div>
            <div className="font-code-sm text-code-sm text-on-surface break-all bg-surface-container-lowest p-2 rounded leading-relaxed select-all">
              {tokenJwt}
            </div>
            {decodedClaims && (
              <pre className="bg-inverse-surface text-inverse-on-surface p-2 rounded font-code-sm text-code-sm overflow-x-auto">
                {decodedClaims}
              </pre>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(tokenJwt);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 1500);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {copiedToken ? 'check' : 'content_copy'}
                </span>
                <span>{copiedToken ? 'Copiado!' : 'Copiar Token'}</span>
              </button>
              <button
                type="button"
                onClick={handleDecodeJwt}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">
                  code_blocks
                </span>
                <span>{decodedClaims ? 'Ocultar Claims' : 'Decodificar'}</span>
              </button>
            </div>
          </div>

          {/* Revalidate button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleRevalidate()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              refresh
            </span>
            <span>
              {isLoading
                ? 'Consultando /users/me...'
                : 'Testar Revalidação (/users/me)'}
            </span>
            <span className="font-code-sm text-code-sm bg-surface-container-highest text-on-surface-variant px-1.5 py-0.2 rounded font-semibold ml-1">
              GET
            </span>
          </button>
        </section>
      </DevOnly>

      {/* Logout Button */}
      <button
        type="button"
        onClick={() => {
          logout();
          void navigate('/auth');
        }}
        className="w-full flex items-center justify-center gap-2 py-3 px-space-md rounded-xl bg-error-container hover:bg-error-container/80 text-on-error-container font-label-lg text-label-lg font-medium shadow-sm transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">logout</span>
        <span>Encerrar Sessão (Logout)</span>
      </button>

      <JsonInspectorDrawer
        telemetry={telemetry}
        defaultEndpointLabel="GET /users/me"
      />
    </div>
  );
};
