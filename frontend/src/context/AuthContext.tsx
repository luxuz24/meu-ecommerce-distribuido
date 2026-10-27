import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ApiTelemetryRecord, User } from '../domain/types';
import { userApi } from '../services/api';

interface AuthContextValue {
  tokenJwt: string | null;
  user: User | null;
  lastAuthTelemetry: ApiTelemetryRecord | null;
  isLoading: boolean;
  saveSession: (
    tokenJwt: string,
    user: User,
    telemetry?: ApiTelemetryRecord
  ) => void;
  revalidateProfile: () => Promise<ApiTelemetryRecord | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'microstore_jwt_token';
const USER_STORAGE_KEY = 'microstore_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tokenJwt, setTokenJwt] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  });
  const [lastAuthTelemetry, setLastAuthTelemetry] =
    useState<ApiTelemetryRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const saveSession = (
    newToken: string,
    newUser: User,
    telemetry?: ApiTelemetryRecord
  ) => {
    setTokenJwt(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    if (telemetry) {
      setLastAuthTelemetry(telemetry);
    }
  };

  const logout = () => {
    setTokenJwt(null);
    setUser(null);
    setLastAuthTelemetry(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const revalidateProfile = async (): Promise<ApiTelemetryRecord | null> => {
    if (!tokenJwt) return null;
    setIsLoading(true);
    try {
      const result = await userApi.getMe(tokenJwt);
      setUser(result.data);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.data));
      setLastAuthTelemetry(result.telemetry);
      return result.telemetry;
    } catch {
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tokenJwt && !user) {
      void revalidateProfile();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        tokenJwt,
        user,
        lastAuthTelemetry,
        isLoading,
        saveSession,
        revalidateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
