import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DevOnly,
  EndpointBar,
  JsonInspectorDrawer,
} from '../components/telemetry/DevTelemetry';
import { useAuth } from '../context/AuthContext';
import type { ApiTelemetryRecord } from '../domain/types';
import { ApiError, USER_API_URL, userApi } from '../services/api';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { saveSession } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('dev@microstore.io');
  const [loginPassword, setLoginPassword] = useState('Micro@2026');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register state
  const [regName, setRegName] = useState('Lucas Silva');
  const [regEmail, setRegEmail] = useState('dev@microstore.io');
  const [regPassword, setRegPassword] = useState('Micro@2026');
  const [showRegPass, setShowRegPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<ApiTelemetryRecord | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await userApi.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      setTelemetry(res.telemetry);
      saveSession(res.data.tokenJwt, res.data.user, res.telemetry);
      setSuccessMessage('Autenticação realizada com sucesso! Redirecionando...');
      setTimeout(() => {
        void navigate('/profile');
      }, 600);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(`${err.statusCode} — ${err.message}`);
        setTelemetry(err.telemetry);
      } else {
        setErrorMessage('Falha ao conectar ao user-service (:3000).');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await userApi.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      setTelemetry(res.telemetry);
      setSuccessMessage(
        `Conta criada para ${res.data.email}! Evento USER_CREATED gravado na Outbox (RabbitMQ). Agora faça login.`
      );
      setLoginEmail(regEmail.trim());
      setLoginPassword(regPassword);
      setActiveTab('login');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(`${err.statusCode} — ${err.message}`);
        setTelemetry(err.telemetry);
      } else {
        setErrorMessage('Falha ao conectar ao user-service (:3000).');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate401 = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await userApi.login({
        email: 'naoexiste@microstore.io',
        password: 'wrongpassword',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(`${err.statusCode} Unauthorized — ${err.message}`);
        setTelemetry(err.telemetry);
      }
    } finally {
      setLoading(false);
    }
  };

  const hasMinLen = regPassword.length >= 6;
  const hasNumber = /\d/.test(regPassword);

  return (
    <div className="max-w-xl mx-auto flex flex-col w-full gap-space-md">
      {/* Header Técnico */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            <span>Voltar ao Catálogo</span>
          </Link>

          <DevOnly>
            <div className="inline-flex items-center gap-1.5 bg-tertiary-container/15 px-2.5 py-0.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              <span className="font-code-sm text-code-sm text-tertiary font-medium">
                user-service:3000
              </span>
            </div>
          </DevOnly>
        </div>

        <div className="flex flex-col gap-1 mt-1">
          <DevOnly>
            <div className="flex items-center gap-2">
              <span className="font-code-sm text-code-sm uppercase tracking-wider bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-lg">
                Auth Cluster v1.4
              </span>
              <span className="font-code-sm text-code-sm text-primary font-medium">
                POST /login &amp; POST /users
              </span>
            </div>
          </DevOnly>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
            Acesso à Conta MicroStore
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Entre com suas credenciais ou cadastre-se para validar sua sessão JWT.
          </p>
        </div>
      </div>

      {/* Abas Alternáveis */}
      <div className="bg-surface-container-high p-1 rounded-xl flex items-center">
        <button
          type="button"
          onClick={() => {
            setActiveTab('login');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 px-3 rounded-lg font-label-lg text-label-lg text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'login'
              ? 'bg-surface-container-lowest text-on-surface shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] text-primary">
            login
          </span>
          <span>Entrar (Login)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('register');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 px-3 rounded-lg font-label-lg text-label-lg text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'register'
              ? 'bg-surface-container-lowest text-on-surface shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            person_add
          </span>
          <span>Criar Conta (Register)</span>
        </button>
      </div>

      {/* Feedback de Sucesso / Erro */}
      {successMessage && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-tertiary-fixed/40 text-on-tertiary-fixed border border-tertiary/20">
          <span className="material-symbols-outlined text-[20px] text-tertiary shrink-0">
            check_circle
          </span>
          <span className="font-body-sm text-body-sm font-medium">
            {successMessage}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-error-container text-on-error-container">
          <span className="material-symbols-outlined text-[20px] text-error shrink-0">
            error
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-label-md text-label-md font-semibold">
              Falha na Requisição
            </span>
            <span className="font-body-sm text-body-sm">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Painel Login */}
      {activeTab === 'login' ? (
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-high flex flex-col gap-space-md">
          <EndpointBar method="POST" endpoint={`${USER_API_URL}/login`} />

          <form onSubmit={(e) => void handleLogin(e)} className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
              >
                <span>E-mail</span>
                <DevOnly>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    payload.email
                  </span>
                </DevOnly>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant">
                  mail
                </span>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="dev@microstore.io"
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
              >
                <span>Senha</span>
                <DevOnly>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    payload.password
                  </span>
                </DevOnly>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant">
                  key
                </span>
                <input
                  id="login-password"
                  type={showLoginPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass((v) => !v)}
                  className="absolute right-3 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showLoginPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg font-medium flex items-center justify-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  lock_open
                </span>
                <span>{loading ? 'Autenticando...' : 'Entrar na Conta'}</span>
                <DevOnly>
                  <span className="font-code-sm text-code-sm bg-primary-container px-1.5 py-0.5 rounded ml-auto text-on-primary-container">
                    POST
                  </span>
                </DevOnly>
              </button>

              <DevOnly>
                <button
                  type="button"
                  onClick={() => void handleSimulate401()}
                  className="w-full py-1.5 px-3 text-on-surface-variant hover:text-error font-code-sm text-code-sm text-center transition-colors"
                >
                  ⚡ Simular Resposta 401 INVALID_CREDENTIALS
                </button>
              </DevOnly>
            </div>
          </form>
        </div>
      ) : (
        /* Painel Cadastro */
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-high flex flex-col gap-space-md">
          <EndpointBar
            method="POST"
            endpoint={`${USER_API_URL}/users`}
            badgeText="201 Created + Outbox"
          />

          <DevOnly>
            <div className="p-3 bg-secondary-container/40 rounded-lg flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">
                hub
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-label-md text-label-md font-semibold text-on-secondary-fixed">
                    Arquitetura Assíncrona (Outbox Pattern)
                  </span>
                  <span className="font-code-sm text-code-sm bg-primary text-on-primary px-1.5 rounded">
                    RabbitMQ
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Ao criar sua conta, um evento{' '}
                  <code className="font-code-sm text-code-sm text-primary bg-surface-container-high px-1 rounded">
                    USER_CREATED
                  </code>{' '}
                  é gravado na tabela Outbox na mesma transação Postgres e publicado no RabbitMQ para o{' '}
                  <code>notification-service</code>.
                </p>
              </div>
            </div>
          </DevOnly>

          <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-name"
                className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
              >
                <span>Nome Completo</span>
                <DevOnly>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    min. 2 chars
                  </span>
                </DevOnly>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant">
                  badge
                </span>
                <input
                  id="reg-name"
                  type="text"
                  required
                  minLength={2}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Lucas Silva"
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-email"
                className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
              >
                <span>E-mail</span>
                <DevOnly>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    unique: true
                  </span>
                </DevOnly>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant">
                  alternate_email
                </span>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="lucas@microstore.io"
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-password"
                className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
              >
                <span>Senha Segura</span>
                <DevOnly>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    bcrypt hash
                  </span>
                </DevOnly>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant">
                  password
                </span>
                <input
                  id="reg-password"
                  type={showRegPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPass((v) => !v)}
                  className="absolute right-3 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showRegPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1 bg-surface-container-low p-2 rounded-lg">
                <div
                  className={`flex items-center gap-1.5 font-code-sm text-code-sm ${
                    hasMinLen ? 'text-tertiary' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {hasMinLen ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span>Min. 6 caracteres</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 font-code-sm text-code-sm ${
                    hasNumber ? 'text-tertiary' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {hasNumber ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span>1 ou mais números</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-tertiary text-on-tertiary rounded-lg font-label-lg text-label-lg font-medium flex items-center justify-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                outbox
              </span>
              <span>
                {loading
                  ? 'Registrando...'
                  : 'Criar Conta & Disparar Evento'}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Console de Telemetria JWT (Exclusivo Dev Mode) */}
      <JsonInspectorDrawer
        telemetry={telemetry}
        defaultEndpointLabel={
          activeTab === 'login' ? 'POST /login' : 'POST /users'
        }
      />
    </div>
  );
};
