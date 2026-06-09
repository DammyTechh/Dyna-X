import Link from 'next/link';
import {
  Boxes, CreditCard, FileText, Brain, Calendar,
  MessageSquare, ShieldCheck, Check, ArrowRight,
} from 'lucide-react';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SITE, PORTALS } from '@/lib/site';

export const metadata = {
  title: `Products — ${SITE.name}`,
  description: 'The DynaX product suite: clinical workspace, 3D scan editor, EMR, AI assist and TheraPay.',
};

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="pt-36 pb-16">
        <div className="container max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-dynax-teal">Products</span>
          <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold text-slate-900">
            Everything a rehab team needs
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            A connected suite of clinical tools — built around how multidisciplinary
            rehabilitation actually works.
          </p>
        </div>
      </section>

      {/* Product grid */}
      <section className="pb-8">
        <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm">
              <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${p.bg}`}>
                <p.icon className={`h-6 w-6 ${p.fg}`} />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Professionals section */}
      <section id="professionals" className="mt-12 border-y border-slate-100 bg-slate-50 py-20">
        <div className="container max-w-4xl">
          <h2 className="text-center font-display text-3xl font-bold text-slate-900">
            Choose your professional workspace
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
            Each discipline gets a tailored portal. Sign in or request access below.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <PortalCard
              title="Prosthetist & Orthotist"
              href={PORTALS.prosthetistOrthotist}
              points={['Device measurement records', '3D scan editor & collaboration', 'Fabrication status tracking', 'Patient EMR & care plans']}
              accent="teal"
            />
            <PortalCard
              title="Physiotherapy"
              href={PORTALS.physiotherapy}
              points={['SOAP notes & care plans', 'Exercise program builder', 'Appointment scheduling', 'Progress tracking & AI assist']}
              accent="blue"
            />
          </div>
        </div>
      </section>

      {/* Payment model */}
      <section id="pricing" className="py-20">
        <div className="container max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
            <ShieldCheck className="h-4 w-4" /> Patient-first pricing
          </div>
          <h2 className="mt-5 font-display text-3xl md:text-4xl font-bold text-slate-900">
            Professionals and clinics are the paying customers
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Patients never pay for basic platform access. Clinics and professionals
            subscribe for the clinical workspace; patients only pay — when they
            choose to — for specific value-added services through TheraPay.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/contact?subject=pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-dynax-blue px-7 py-3.5 font-semibold text-white transition-colors hover:bg-dynax-blue-dark"
            >
              Talk to sales <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/register?role=patient"
              className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 px-7 py-3.5 font-semibold text-slate-800 transition-colors hover:bg-slate-50"
            >
              Patient? Join free
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function PortalCard({
  title, href, points, accent,
}: { title: string; href: string; points: string[]; accent: 'teal' | 'blue' }) {
  const accentText = accent === 'teal' ? 'text-dynax-teal' : 'text-dynax-blue';
  return (
    <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8">
      <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
      <ul className="mt-5 space-y-3 text-sm text-slate-700">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${accentText}`} /> {p}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
      >
        Open workspace <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

const PRODUCTS = [
  { title: 'Clinical EMR', icon: FileText, bg: 'bg-blue-50', fg: 'text-blue-600', desc: 'Structured clinical notes, care plans and device records with a full audit trail.' },
  { title: '3D Scan Editor', icon: Boxes, bg: 'bg-teal-50', fg: 'text-teal-600', desc: 'Import, view, edit and measure limb scans — share with per-person permissions. P&O only.' },
  { title: 'AI Assist', icon: Brain, bg: 'bg-purple-50', fg: 'text-purple-600', desc: 'Draft SOAP notes and care-plan suggestions, grounded in the patient record.' },
  { title: 'Scheduling', icon: Calendar, bg: 'bg-orange-50', fg: 'text-orange-600', desc: 'Appointments, sessions and reminders for the whole care team.' },
  { title: 'Secure Messaging', icon: MessageSquare, bg: 'bg-green-50', fg: 'text-green-600', desc: 'Private patient–professional conversations, kept inside the record.' },
  { title: 'TheraPay', icon: CreditCard, bg: 'bg-pink-50', fg: 'text-pink-600', desc: 'Flexible billing for value-added services — bundles, installments and subscriptions.' },
];
