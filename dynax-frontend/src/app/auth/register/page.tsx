'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useRegister } from '@/hooks/useApi';
import { tokenStore } from '@/lib/api';
import { getDashboardRoute } from '@/lib/routing';

const ROLES = [
  { value: 'patient', label: 'Patient', desc: 'Seeking rehabilitation or prosthetic care', icon: '🏥' },
  { value: 'physiotherapist', label: 'Physiotherapist', desc: 'Physical therapy & rehabilitation', icon: '🦴' },
  { value: 'prosthetist', label: 'Prosthetist', desc: 'Prosthetic device specialist', icon: '🦾' },
  { value: 'orthotist', label: 'Orthotist', desc: 'Orthotic support specialist', icon: '🦿' },
  { value: 'occupational_therapist', label: 'OT Therapist', desc: 'Occupational therapy', icon: '🤝' },
  { value: 'speech_therapist', label: 'Speech Therapist', desc: 'Speech & language therapy', icon: '🗣️' },
  { value: 'mental_health_clinician', label: 'Mental Health', desc: 'Psychological & mental health care', icon: '🧠' },
];

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.string().min(1, 'Please select a role'),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') || '';
  const [showPwd, setShowPwd] = useState(false);
  const { mutateAsync: register, isPending } = useRegister();

  const { register: formReg, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: FormData) => {
    try {
      const res = await register(data);
      tokenStore.setTokens(res.access_token, res.refresh_token, res.user.role);
      toast.success('Account created! Welcome to DynaX.');
      router.push(getDashboardRoute(res.user.role));
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl dynax-gradient flex items-center justify-center">
              <span className="text-white font-display font-bold">DX</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-slate-900">Create your DynaX account</h1>
              <p className="text-slate-500 text-sm">Free to join. No credit card required.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">I am a…</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setValue('role', role.value, { shouldValidate: true })}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      selectedRole === role.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {selectedRole === role.value && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                    <span className="text-xl block mb-1">{role.icon}</span>
                    <span className="text-xs font-semibold text-slate-800 block leading-tight">{role.label}</span>
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-red-500 text-xs mt-2">{errors.role.message}</p>}

              {/* Professional note */}
              {selectedRole && selectedRole !== 'patient' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <strong>Professional accounts</strong> require admin approval before you can accept patients. You&apos;ll receive an email once approved.
                </div>
              )}

              {/* Patient code note */}
              {selectedRole === 'patient' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                  <strong>Patients:</strong> After registering, your professional can email you a DX-PIN code, or you can enter their code directly in your dashboard to connect.
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                <input
                  {...formReg('full_name')}
                  type="text"
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition text-sm"
                />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                <input
                  {...formReg('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition text-sm"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...formReg('password')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl dynax-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Creating account…' : 'Create Account'}
            </button>

            <p className="text-xs text-slate-500 text-center">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
