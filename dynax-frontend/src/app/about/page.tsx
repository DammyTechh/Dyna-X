import Link from 'next/link';
import { Target, Eye, Users, Globe } from 'lucide-react';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SITE } from '@/lib/site';

export const metadata = {
  title: `About — ${SITE.name}`,
  description: `About ${SITE.company} and the DynaX platform.`,
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-20">
        <div className="pointer-events-none absolute -top-32 right-0 -z-10 h-[28rem] w-[28rem] rounded-full bg-dynax-teal/10 blur-3xl" />
        <div className="container max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-dynax-teal">About DynaX</span>
          <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold text-slate-900">
            Rehabilitation care, <span className="dynax-gradient-text">connected.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            DynaX is built by {SITE.company} to close the gap between patients and
            the rehabilitation professionals who care for them — bringing
            physiotherapy, prosthetics, orthotics and allied therapy into one
            connected, clinically rigorous platform.
          </p>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="container grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-white p-8">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <Target className="h-6 w-6 text-dynax-blue" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Our mission</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Make high-quality rehabilitation accessible to every patient — by
              giving clinicians modern tools and removing cost barriers to basic
              access to care.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-8">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
              <Eye className="h-6 w-6 text-dynax-teal" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Our vision</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">
              A connected continent of care where a patient&apos;s rehabilitation
              journey — from first scan to fitted device to full recovery — is
              coordinated by one multidisciplinary team on one platform.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="container max-w-4xl">
          <h2 className="text-center font-display text-3xl font-bold text-slate-900">What we stand for</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { icon: Users, title: 'Patient-first', desc: 'Basic access to care is free for patients. Always.' },
              { icon: Globe, title: 'Built for Africa', desc: 'Designed for the realities of care delivery on the continent.' },
              { icon: Target, title: 'Clinically rigorous', desc: 'Real EMR, structured notes and auditable records.' },
            ].map((v) => (
              <div key={v.title} className="text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <v.icon className="h-6 w-6 text-slate-700" />
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="container">
          <div className="rounded-3xl dynax-gradient px-8 py-14 text-center text-white">
            <h2 className="font-display text-3xl font-bold">Want to bring DynaX to your clinic?</h2>
            <p className="mx-auto mt-3 max-w-lg text-blue-50">We&apos;d love to hear from you.</p>
            <Link
              href="/contact"
              className="mt-7 inline-block rounded-xl bg-white px-8 py-3.5 font-bold text-dynax-blue shadow-xl transition-colors hover:bg-blue-50"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
