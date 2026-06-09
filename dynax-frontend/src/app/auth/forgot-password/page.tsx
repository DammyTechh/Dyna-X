'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/lib/auth';
import { Logo } from '@/components/brand/Logo';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      toast.success('If that email exists, a reset code is on its way.');
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      toast.error((err as Error).message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-white p-4">
      <div className="w-full max-w-md">
        <Link href="/auth/login" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-xl">
          <div className="mb-5 flex justify-center"><Logo size={34} /></div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <KeyRound className="h-7 w-7 text-dynax-blue" />
          </div>
          <h1 className="text-center font-display text-xl font-bold text-slate-900">Forgot your password?</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Enter your email and we&apos;ll send you a 6-digit reset code.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-dynax-blue focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-dynax-blue py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-dynax-blue-dark disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
