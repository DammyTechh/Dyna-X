'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';

// Restores the session as soon as the app mounts, so reopening an installed PWA
// doesn't flash the login screen while a stale access token is renewed.
// Lives in its own client component because the root layout is a Server
// Component (it exports `metadata`) and so cannot run effects itself.
export default function AuthInitializer() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return null;
}
