import Link from 'next/link';
import {
  ArrowRight, Bone, Hand, Brain, MessageSquare, HeartHandshake,
  CreditCard, Boxes, Check,
} from 'lucide-react';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SITE, PORTALS } from '@/lib/site';

export const metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      {/* ───────────────────── Hero ───────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-24">
        {/* Atmospheric background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 h-[34rem] w-[34rem] rounded-full bg-dynax-blue/10 blur-3xl" />
          <div className="absolute top-20 -left-32 h-[30rem] w-[30rem] rounded-full bg-dynax-teal/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgb(226 232 240) 1px, transparent 0)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 100%)',
            }}
          />
        </div>

        <div className="container max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm animate-fade-in">
            <span className="h-2 w-2 rounded-full bg-dynax-teal animate-pulse" />
            Built for rehabilitation teams across Africa
          </div>

          <h1 className="mt-8 font-display text-5xl md:text-7xl font-bold leading-[1.05] text-slate-900 animate-slide-up">
            Advanced care for
            <span className="dynax-gradient-text block">every patient.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-slate-600 animate-fade-in">
            One connected platform for patients, prosthetists, orthotists and
            therapists — with AI-assisted clinical tools, real-time 3D scan
            collaboration, and flexible care payments.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link
              href="/auth/register?role=patient"
              className="group inline-flex items-center gap-2 rounded-xl bg-dynax-blue px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-dynax-blue-dark hover:-translate-y-0.5 hover:shadow-xl"
            >
              I&apos;m a patient
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/products#professionals"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-8 py-3.5 text-base font-semibold text-slate-800 transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              I&apos;m a professional
            </Link>
          </div>

          {/* Portal quick-links */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span>Go to your workspace:</span>
            <Link href={PORTALS.prosthetistOrthotist} className="font-medium text-dynax-blue hover:underline">
              Prosthetist &amp; Orthotist
            </Link>
            <Link href={PORTALS.physiotherapy} className="font-medium text-dynax-blue hover:underline">
              Physiotherapy
            </Link>
            <Link href={PORTALS.patient} className="font-medium text-dynax-blue hover:underline">
              Patient
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────── Specialties ───────────────────── */}
      <section id="specialties" className="border-t border-slate-100 bg-slate-50 py-24">
        <div className="container">
          <SectionHeading
            eyebrow="One platform, every specialty"
            title="All of rehabilitation, under one roof"
            sub="From physiotherapy to prosthetics — DynaX gives each discipline the tools it actually needs, while keeping the whole care team in sync."
          />
          <div className="cards-3d mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-3d group rounded-2xl border border-slate-100 bg-white p-7 shadow-sm"
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.bg}`}>
                  <f.icon className={`h-6 w-6 ${f.fg}`} />
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── 3D Editor highlight ───────────────────── */}
      <section className="py-24">
        <div className="container grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-dynax-teal">
              For Prosthetists &amp; Orthotists
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold text-slate-900">
              A 3D scan editor built for clinical collaboration
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Import scans, inspect and edit limb geometry, take parametric
              measurements, and share a model with colleagues — granting
              view, comment or annotate access per person. Every change and
              comment is tracked.
            </p>
            <ul className="mt-6 space-y-3">
              {EDITOR_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-dynax-teal" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href={PORTALS.prosthetistOrthotist}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Open the P&amp;O workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-slate-200 dynax-gradient p-1 shadow-2xl shadow-blue-200/50">
              <div className="flex h-full w-full items-center justify-center rounded-[1.4rem] bg-slate-900/95">
                <div className="relative">
                  <Boxes className="h-28 w-28 text-white/90" strokeWidth={1} />
                  <div className="absolute -right-6 -top-4 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg">
                    Socket Ø 142mm
                  </div>
                  <div className="absolute -bottom-3 -left-8 rounded-lg bg-dynax-teal px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                    2 collaborators
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── Pricing / payment model ───────────────────── */}
      <section id="pricing" className="border-y border-slate-100 bg-slate-50 py-24">
        <div className="container">
          <SectionHeading
            eyebrow="Fair, transparent pricing"
            title="Professionals & clinics pay. Patients don't pay to access care."
            sub="Basic platform access is always free for patients. Clinics and professionals subscribe for the clinical workspace — patients only ever pay for specific value-added services."
          />

          <div className="cards-3d mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
            {/* Patient */}
            <div className="card-3d rounded-3xl border border-slate-200 bg-white p-8">
              <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                Patients
              </span>
              <p className="mt-4 font-display text-4xl font-bold text-slate-900">Free</p>
              <p className="mt-1 text-sm text-slate-500">Basic platform access, always.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {PATIENT_INCLUDED.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> {p}
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                Optional value-added services (e.g. priority device fabrication,
                expedited reviews) are pay-as-you-go via TheraPay.
              </p>
              <Link
                href="/auth/register?role=patient"
                className="mt-6 block rounded-xl bg-dynax-blue py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-dynax-blue-dark"
              >
                Create free account
              </Link>
            </div>

            {/* Professionals / clinics */}
            <div className="card-3d relative rounded-3xl border-2 border-dynax-blue bg-white p-8 shadow-xl shadow-blue-100">
              <span className="absolute -top-3 right-6 rounded-full dynax-gradient px-3 py-1 text-xs font-semibold text-white shadow">
                Primary plan
              </span>
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Professionals &amp; Clinics
              </span>
              <p className="mt-4 font-display text-4xl font-bold text-slate-900">
                Subscription
              </p>
              <p className="mt-1 text-sm text-slate-500">Per professional, billed to the practice.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {PRO_INCLUDED.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-dynax-blue" /> {p}
                  </li>
                ))}
              </ul>
              <Link
                href="/contact?subject=pricing"
                className="mt-6 block rounded-xl bg-slate-900 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── How it works ───────────────────── */}
      <section className="py-24">
        <div className="container max-w-4xl">
          <SectionHeading eyebrow="Getting started" title="How DynaX works" />
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl dynax-gradient font-display text-xl font-bold text-white shadow-lg">
                  {i + 1}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── CTA ───────────────────── */}
      <section className="px-4 pb-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl dynax-gradient px-8 py-16 text-center text-white shadow-2xl shadow-blue-200/50">
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Ready to transform rehabilitation care?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-blue-50">
              Patients join free. Clinics and professionals get a complete
              clinical workspace.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/register?role=patient"
                className="rounded-xl bg-white px-8 py-3.5 text-base font-bold text-dynax-blue shadow-xl transition-colors hover:bg-blue-50"
              >
                Create free account
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border-2 border-white/40 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

/* ── Reusable section heading ── */
function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-wide text-dynax-teal">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-slate-900">{title}</h2>
      {sub && <p className="mt-4 text-slate-600 leading-relaxed">{sub}</p>}
    </div>
  );
}

const FEATURES = [
  { title: 'Physiotherapy', icon: Bone, bg: 'bg-blue-50', fg: 'text-blue-600', desc: 'SOAP notes, care plans, exercise programs and session scheduling for physio professionals.' },
  { title: 'Prosthetics & Orthotics', icon: Hand, bg: 'bg-teal-50', fg: 'text-teal-600', desc: '3D scan editor, parametric measurements and device tracking from draft to delivery.' },
  { title: 'Mental Health', icon: Brain, bg: 'bg-purple-50', fg: 'text-purple-600', desc: 'Mood tracking, digital journals, session booking and confidential clinical notes.' },
  { title: 'Speech Therapy', icon: MessageSquare, bg: 'bg-orange-50', fg: 'text-orange-600', desc: 'Exercise libraries, progress trackers and goal management for speech therapists.' },
  { title: 'Occupational Therapy', icon: HeartHandshake, bg: 'bg-green-50', fg: 'text-green-600', desc: 'ADL assessments, home exercise programs and collaborative care planning.' },
  { title: 'TheraPay', icon: CreditCard, bg: 'bg-pink-50', fg: 'text-pink-600', desc: 'Flexible payments for value-added services — session, bundle, or installment.' },
];

const EDITOR_POINTS = [
  'Import & view scan files (GLB / GLTF / STL / OBJ)',
  'Edit geometry, measure, annotate and add notes',
  'Share with per-person view / comment / annotate rights',
  'Threaded comments tied to the model revision',
];

const PATIENT_INCLUDED = [
  'Connect to your care team',
  'Appointments, sessions & care plans',
  'Secure messaging with professionals',
  'Track rehabilitation progress',
];

const PRO_INCLUDED = [
  'Full clinical EMR & care planning',
  'Patient management & scheduling',
  'AI-assisted notes & care suggestions',
  '3D scan editor (P&O) + collaboration',
  'TheraPay billing for value-added services',
];

const STEPS = [
  { title: 'Register & connect', desc: 'Create your account and link to your care team via a unique DX-PIN code.' },
  { title: 'Start your care journey', desc: 'Book appointments, receive care plans and track your rehabilitation progress.' },
  { title: 'Collaborate & grow', desc: 'Professionals share 3D scans, notes and progress across your care team.' },
];
