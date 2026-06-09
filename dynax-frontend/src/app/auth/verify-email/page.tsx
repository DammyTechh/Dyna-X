'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useVerifyEmail, useResendVerification } from '@/hooks/useApi';
import { Logo } from '@/components/brand/Logo';
import { OtpInput } from '@/components/auth/OtpInput';

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const { mutateAsync: verify, isPending } = useVerifyEmail();
  const { mutateAsync: resend, isPending: resending } = useResendVerification();
  const [code, setCode] = useState('');

  const submit = async (value?: string) => {
    const c = value ?? code;
    if (c.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    try {
      await verify({ email, code: c });
      toast.success('Email verified! You can now sign in.');
      router.push('/auth/login');
    } catch (err) {
      toast.error((err as Error).message || 'Invalid or expired code');
      setCode('');
    }
  };

  const onResend = async () => {
    if (!email) {
      toast.error('No email on file — please register again.');
      return;
    }
    try {
      await resend(email);
      toast.success('A new code is on its way.');
    } catch (err) {
      toast.error((err as Error).message || 'Could not resend code');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-white p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-xl">
          <div className="mb-5 flex justify-center"><Logo size={34} /></div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <MailCheck className="h-7 w-7 text-dynax-blue" />
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900">Enter your code</h1>
          <p className="mt-2 text-sm text-slate-500">
            We sent a 6-digit verification code{email ? <> to <strong className="text-slate-700">{email}</strong></> : ''}.
          </p>

          <div className="mt-7">
            <OtpInput value={code} onChange={setCode} onComplete={(v) => submit(v)} />
          </div>

          <button
            onClick={() => submit()}
            disabled={isPending || code.length !== 6}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-dynax-blue py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-dynax-blue-dark disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Verifying…' : 'Verify email'}
          </button>

          <p className="mt-6 text-sm text-slate-500">
            Didn&apos;t get it?{' '}
            <button onClick={onResend} disabled={resending} className="font-medium text-dynax-blue hover:underline disabled:opacity-50">
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Already verified?{' '}
            <Link href="/auth/login" className="font-medium text-dynax-blue hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
