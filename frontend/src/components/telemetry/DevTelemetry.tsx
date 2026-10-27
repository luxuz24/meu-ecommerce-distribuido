import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import type { ApiTelemetryRecord } from '../../domain/types';

/**
 * Wrapper component that renders children ONLY when Dev/Telemetry mode is active.
 * In final production builds (or when the user toggles Clean Store Mode), this renders null.
 */
export const DevOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDevMode } = useTelemetry();
  if (!isDevMode) return null;
  return <>{children}</>;
};

export const EndpointBar: React.FC<{
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  badgeText?: string;
}> = ({ method, endpoint, badgeText }) => {
  const [copied, setCopied] = useState(false);

  const methodColor =
    method === 'GET'
      ? 'bg-primary text-on-primary'
      : method === 'POST'
        ? 'bg-tertiary text-on-tertiary'
        : method === 'PATCH'
          ? 'bg-primary-container text-on-primary'
          : 'bg-error text-on-error';

  const handleCopy = () => {
    void navigator.clipboard?.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <DevOnly>
      <div className="flex items-center justify-between bg-surface-container-low px-space-sm py-1.5 rounded-lg">
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={`font-code-sm text-code-sm font-bold px-1.5 py-0.5 rounded ${methodColor}`}
          >
            {method}
          </span>
          <span className="font-code-sm text-code-sm text-on-surface-variant truncate">
            {endpoint}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {badgeText && (
            <span className="font-code-sm text-code-sm bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded">
              {badgeText}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            title="Copiar Endpoint"
            className="text-on-surface-variant hover:text-on-surface p-1 transition-colors flex items-center"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
      </div>
    </DevOnly>
  );
};

export const JsonInspectorDrawer: React.FC<{
  telemetry: ApiTelemetryRecord | null;
  defaultEndpointLabel: string;
}> = ({ telemetry, defaultEndpointLabel }) => {
  const [open, setOpen] = useState(false);

  const isSuccess = telemetry ? telemetry.statusCode < 400 : true;

  return (
    <DevOnly>
      <section className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container-high">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full p-space-md flex items-center justify-between text-left hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className={`font-code-sm text-code-sm px-1.5 py-0.5 rounded font-bold ${
                isSuccess
                  ? 'bg-tertiary-fixed-dim text-on-tertiary-fixed'
                  : 'bg-error text-on-error'
              }`}
            >
              {telemetry ? `${telemetry.statusCode}` : 'READY'}
            </span>
            <span className="font-code-sm text-code-sm text-on-surface font-semibold truncate">
              {telemetry
                ? `${telemetry.method} ${telemetry.endpoint}`
                : defaultEndpointLabel}
            </span>
            {telemetry && (
              <span className="font-code-sm text-code-sm text-tertiary bg-surface-container-low px-1.5 py-0.5 rounded shrink-0">
                {telemetry.latencyMs}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant shrink-0">
            <span className="font-code-sm text-code-sm hidden sm:inline">
              JSON Telemetry Inspector
            </span>
            <span
              className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            >
              expand_more
            </span>
          </div>
        </button>

        {open && (
          <div className="px-space-md pb-space-md flex flex-col gap-space-xs">
            <div className="bg-inverse-surface text-inverse-on-surface p-space-sm rounded-lg font-code-sm text-code-sm overflow-x-auto max-h-64">
              <p className="text-tertiary-fixed-dim mb-1">
                // {telemetry?.service || 'microservice'} ·{' '}
                {telemetry?.timestamp || 'waiting request'}
              </p>
              <pre className="leading-relaxed">
                {JSON.stringify(
                  telemetry?.responseBody ?? {
                    info: 'Nenhuma chamada disparada ainda ou aguardando resposta.',
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
      </section>
    </DevOnly>
  );
};
