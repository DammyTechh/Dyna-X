'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLogin } from '@/hooks/useApi';
import { getDashboardRoute, getRoleLabel } from '@/lib/routing';
import { authService } from '@/lib/auth';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

interface PortalAuthProps {
  title: string;
  subtitle: string;
  /** Roles permitted to use this portal. */
  allowedRoles: string[];
  /** Roles offered in the "request access" register link (omit for admin). */
  registerRoles?: { value: string; label: string }[];
  accent?: 'blue' | 'teal' | 'slate';
  secure?: boolean;
}

export function PortalAuth({
  title, subtitle, allowedRoles, registerRoles, accent = 'blue', secure = false,
}: PortalAuthProps) {
  const router = useRouter();
  const { mutateAsync: login, isPending } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await login({ email, password });
      const role = res.user.role;
      if (!allowedRoles.includes(role)) {
        // Wrong portal for this account — sign back out and explain.
        await authService.logout();
        setError(
          `This portal is for ${allowedRoles.map(getRoleLabel).join(' / ')} accounts. ` +
          `Your account is registered as ${getRoleLabel(role)}.`
        );
        return;
      }
      toast.success('Signed in');
      router.push(getDashboardRoute(role));
    } catch (err) {
      const msg = (err as Error).message || 'Sign in failed';
      if (/verify/i.test(msg)) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(msg);
    }
  };

  const ring = accent === 'teal' ? 'focus:ring-teal-100 focus:border-dynax-teal'
    : accent === 'slate' ? 'focus:ring-slate-200 focus:border-slate-500'
    : 'focus:ring-blue-100 focus:border-dynax-blue';
  const btn = accent === 'teal' ? 'bg-dynax-teal hover:opacity-90'
    : accent === 'slate' ? 'bg-slate-900 hover:bg-slate-800'
    : 'bg-dynax-blue hover:bg-dynax-blue-dark';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-white p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <Logo size={32} />
            {secure && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                <ShieldCheck className="h-3 w-3" /> Secure area
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn('w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:ring-2', ring)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                  className={cn('w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-10 text-sm outline-none transition focus:ring-2', ring)}
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-800">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit" disabled={isPending}
              className={cn('flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60', btn)}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {registerRoles && registerRoles.length > 0 && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Need access?{' '}
              <Link
                href={`/auth/register?role=${registerRoles[0].value}`}
                className="font-medium text-dynax-blue hover:underline"
              >
                Request a professional account
              </Link>
            </p>
          )}
          {secure && (
            <p className="mt-6 text-center text-xs text-slate-400">
              Administrator accounts are provisioned internally.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PortalAuth;
