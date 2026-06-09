'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/lib/auth';
import { Logo } from '@/components/brand/Logo';
import { OtpInput } from '@/components/auth/OtpInput';

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authService.resetPassword(email, code, password);
      toast.success('Password reset! You can now sign in.');
      router.push('/auth/login');
    } catch (err) {
      toast.error((err as Error).message || 'Invalid or expired code');
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
            <ShieldCheck className="h-7 w-7 text-dynax-blue" />
          </div>
          <h1 className="text-center font-display text-xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Enter the code sent{email ? <> to <strong className="text-slate-700">{email}</strong></> : ''} and choose a new password.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <OtpInput value={code} onChange={setCode} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-dynax-blue focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-dynax-blue py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-dynax-blue-dark disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Didn&apos;t get a code?{' '}
            <Link href="/auth/forgot-password" className="font-medium text-dynax-blue hover:underline">Request again</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
