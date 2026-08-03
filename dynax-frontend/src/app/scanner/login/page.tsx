'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';
import { useLogin } from '@/hooks/useApi';
import { tokenStore } from '@/lib/api';

// The scanner's own entry point — sign in with a DynaX account without going
// through the DynaX clinic app. Same auth, standalone surface.
export default function ScannerLogin() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenStore.getAccess()) router.replace('/scanner');
  }, [router]);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your DynaX email and password.');
      return;
    }
    try {
      await login.mutateAsync({ email: email.trim(), password });
      router.replace('/scanner');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex items-center justify-center overflow-hidden rounded-3xl p-3 shadow-lg ring-1 ring-white/10">
            <Image
              src="/images/dynax-icon.png"
              alt="DynaXcan"
              width={96}
              height={96}
              priority
              className="h-24 w-24 object-contain"
            />
          </span>
          <h1 className="text-2xl font-bold text-white">DynaXcan</h1>
          <p className="max-w-xs text-sm text-slate-300">
            Capture, reconstruct and review 3D scans. Sign in with your DynaX account.
          </p>
        </div>

        <div className="relative space-y-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          {/* Gradient shimmer sweeping the card while the sign-in request is in flight. */}
          {login.isPending && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_35%,rgba(20,184,166,0.18)_50%,transparent_65%)] bg-[length:200%_100%]"
            />
          )}

          {login.isPending && <SignInWave />}

          <Field icon={Mail} placeholder="DynaX email" type="email" value={email} onChange={setEmail} />
          <Field icon={Lock} placeholder="Password" type="password" value={password} onChange={setPassword} />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            onClick={submit}
            disabled={login.isPending}
            className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-700 to-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-slate-600 hover:to-teal-500 disabled:opacity-60"
          >
            {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in with DynaX
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">One DynaX account across Clinic, Scanner and Studio.</p>
      </div>
    </div>
  );
}

// Mini wave shown above the form while the sign-in request is pending — the
// bars pulse out of phase so the card reads as "working", not frozen.
function SignInWave() {
  return (
    <div className="relative flex flex-col items-center gap-2 pb-1">
      <div className="flex items-end gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-4 w-1 animate-pulse rounded-full bg-teal-400"
            style={{ animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
          />
        ))}
      </div>
      <p className="text-xs text-teal-200/80" role="status">
        Signing you in…
      </p>
    </div>
  );
}

function Field({
  icon: Icon, placeholder, type, value, onChange,
}: {
  icon: React.ElementType; placeholder: string; type: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4">
      <Icon className="h-4 w-4 text-slate-400" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        className="h-12 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
      />
    </div>
  );
}
