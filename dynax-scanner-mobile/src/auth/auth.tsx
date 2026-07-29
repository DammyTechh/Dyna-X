import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient, tokenStore } from '@/api/client';

interface LoginResult {
  access_token?: string;
  token?: string;
  role?: string;
}

interface AuthState {
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tokenStore
      .get()
      .then((t) => setToken(t ?? null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiClient.post<LoginResult>('/auth/login', { email, password });
    const access = data.access_token || data.token;
    if (!access) throw new Error('Sign in failed — no token returned.');
    await tokenStore.set(access);
    setToken(access);
  }, []);

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    setToken(null);
  }, []);

  return <AuthContext.Provider value={{ token, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
