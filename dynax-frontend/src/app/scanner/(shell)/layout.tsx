'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScanLine, LogOut, ExternalLink } from 'lucide-react';
import { tokenStore } from '@/lib/api';
import { authService } from '@/lib/auth';
import { getDashboardRoute } from '@/lib/routing';

// Standalone product shell for the DynaX Scanner (scanner.dynax.app). Shares the
// DynaX session but has its own minimal chrome — not the full clinic dashboard.
export default function ScannerShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState('patient');

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      router.replace('/scanner/login');
      return;
    }
    setRole(tokenStore.getRole() || 'patient');
    setReady(true);
  }, [router]);

  async function signOut() {
    await authService.logout();
    router.replace('/scanner/login');
  }

  if (!ready) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/scanner" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-slate-800 text-white">
              <ScanLine className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-slate-900">DynaX Scanner</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={getDashboardRoute(role)}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:flex"
            >
              <ExternalLink className="h-4 w-4" /> Open DynaX Clinic
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
