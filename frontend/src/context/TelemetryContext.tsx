import React, { createContext, useContext, useEffect, useState } from 'react';
import { catalogApi, userApi } from '../services/api';

interface ServiceHealthState {
  online: boolean;
  latencyMs: number | null;
}

interface TelemetryContextValue {
  /**
   * Controls whether developer telemetry, API contract badges, JSON inspectors,
   * and error simulation buttons from the Stitch reference are visible.
   * When false (or in final production), the UI renders as a clean store for end users.
   */
  isDevMode: boolean;
  toggleDevMode: () => void;
  userServiceHealth: ServiceHealthState;
  catalogServiceHealth: ServiceHealthState;
  refreshHealth: () => Promise<void>;
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

const STORAGE_KEY = 'microstore_dev_telemetry_mode';

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    return import.meta.env.VITE_DEV_TELEMETRY !== 'false';
  });

  const [userServiceHealth, setUserServiceHealth] = useState<ServiceHealthState>({
    online: true,
    latencyMs: null,
  });

  const [catalogServiceHealth, setCatalogServiceHealth] =
    useState<ServiceHealthState>({
      online: true,
      latencyMs: null,
    });

  const toggleDevMode = () => {
    setIsDevMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const refreshHealth = async () => {
    try {
      const res = await userApi.checkHealth();
      setUserServiceHealth({ online: true, latencyMs: res.telemetry.latencyMs });
    } catch {
      setUserServiceHealth({ online: false, latencyMs: null });
    }

    try {
      const res = await catalogApi.checkHealth();
      setCatalogServiceHealth({
        online: true,
        latencyMs: res.telemetry.latencyMs,
      });
    } catch {
      setCatalogServiceHealth({ online: false, latencyMs: null });
    }
  };

  useEffect(() => {
    void refreshHealth();
    const interval = setInterval(() => {
      void refreshHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TelemetryContext.Provider
      value={{
        isDevMode,
        toggleDevMode,
        userServiceHealth,
        catalogServiceHealth,
        refreshHealth,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export function useTelemetry(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return ctx;
}
