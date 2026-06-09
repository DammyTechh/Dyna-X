import Link from 'next/link';
import { UserPlus, LinkIcon, CalendarCheck, Activity, ShieldCheck, HeartPulse } from 'lucide-react';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SITE } from '@/lib/site';

export const metadata = {
  title: `Patient Care — ${SITE.name}`,
  description: 'How patients use DynaX to connect with their care team and track recovery.',
};

export default function PatientCarePage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="relative overflow-hidden pt-36 pb-16">
        <div className="pointer-events-none absolute -top-32 left-0 -z-10 h-[28rem] w-[28rem] rounded-full bg-dynax-blue/10 blur-3xl" />
        <div className="container max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-dynax-teal">Patient Care</span>
          <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold text-slate-900">
            Your recovery, <span className="dynax-gradient-text">in your hands.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            DynaX keeps you connected to your physiotherapist, prosthetist and the
            rest of your care team — so you always know what&apos;s next in your
            rehabilitation. And it&apos;s free to join.
          </p>
          <Link
            href="/auth/register?role=patient"
            className="mt-8 inline-block rounded-xl bg-dynax-blue px-8 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-dynax-blue-dark"
          >
            Create your free account
          </Link>
        </div>
      </section>

      {/* Journey */}
      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="container max-w-5xl">
          <h2 className="text-center font-display text-3xl font-bold text-slate-900">Your care journey</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((j, i) => (
              <div key={j.title} className="relative rounded-2xl border border-slate-100 bg-white p-6">
                <span className="absolute right-5 top-5 font-display text-3xl font-bold text-slate-100">
                  {i + 1}
                </span>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                  <j.icon className="h-5 w-5 text-dynax-blue" />
                </div>
                <h3 className="font-display text-base font-semibold text-slate-900">{j.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{j.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reassurance */}
      <section className="py-20">
        <div className="container grid max-w-4xl gap-8 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Free for patients', desc: 'Basic access to your care team and records costs nothing.' },
            { icon: HeartPulse, title: 'Verified email', desc: 'We verify your email so your health data stays yours.' },
            { icon: Activity, title: 'Progress you can see', desc: 'Follow your sessions, care plans and recovery over time.' },
          ].map((r) => (
            <div key={r.title} className="text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
                <r.icon className="h-6 w-6 text-dynax-teal" />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900">{r.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

const JOURNEY = [
  { icon: UserPlus, title: 'Register & verify', desc: 'Sign up free and confirm your email address.' },
  { icon: LinkIcon, title: 'Connect to your team', desc: 'Enter your professional\u2019s DX-PIN code to link up.' },
  { icon: CalendarCheck, title: 'Attend sessions', desc: 'Book appointments and follow your care plan.' },
  { icon: Activity, title: 'Track recovery', desc: 'Watch your progress and message your team anytime.' },
];
