'use client';

import { useState } from 'react';
import { Phone, Mail, MapPin, Send, Check } from 'lucide-react';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SITE } from '@/lib/site';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Composes an email to DynaX. Swap this for a POST to your /contact API
    // endpoint when the backend route is ready.
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    const subject = encodeURIComponent(form.subject || `DynaX enquiry from ${form.name}`);
    window.location.href = `${SITE.emailHref}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="pt-36 pb-20">
        <div className="container grid max-w-5xl gap-12 lg:grid-cols-2">
          {/* Left: info */}
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-dynax-teal">Contact</span>
            <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold text-slate-900">
              Let&apos;s talk
            </h1>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Whether you&apos;re a clinic exploring DynaX, a professional wanting
              access, or a patient who needs help — we&apos;re here.
            </p>

            <div className="mt-10 space-y-5">
              <a href={SITE.phoneHref} className="flex items-center gap-4 group">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Phone className="h-5 w-5 text-dynax-blue" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">Phone</span>
                  <span className="block font-semibold text-slate-800 group-hover:text-dynax-blue transition-colors">
                    {SITE.phone}
                  </span>
                </span>
              </a>
              <a href={SITE.emailHref} className="flex items-center gap-4 group">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
                  <Mail className="h-5 w-5 text-dynax-teal" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
                  <span className="block font-semibold text-slate-800 group-hover:text-dynax-teal transition-colors">
                    {SITE.email}
                  </span>
                </span>
              </a>
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <MapPin className="h-5 w-5 text-slate-700" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">Location</span>
                  <span className="block font-semibold text-slate-800">{SITE.address}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-100">
            {sent ? (
              <div className="flex h-full flex-col items-center justify-center text-center py-10">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900">Thanks for reaching out</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your email client should now be open. If not, reach us directly at{' '}
                  <a href={SITE.emailHref} className="text-dynax-blue underline">{SITE.email}</a>.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Name">
                    <input required value={form.name} onChange={update('name')} className={inputCls} placeholder="Your name" />
                  </Field>
                  <Field label="Email">
                    <input required type="email" value={form.email} onChange={update('email')} className={inputCls} placeholder="you@example.com" />
                  </Field>
                </div>
                <Field label="Subject">
                  <input value={form.subject} onChange={update('subject')} className={inputCls} placeholder="How can we help?" />
                </Field>
                <Field label="Message">
                  <textarea required rows={5} value={form.message} onChange={update('message')} className={inputCls} placeholder="Tell us a little about your needs…" />
                </Field>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl dynax-gradient py-3 font-semibold text-white shadow-lg shadow-blue-200 transition-opacity hover:opacity-90"
                >
                  Send message <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-dynax-blue focus:ring-2 focus:ring-blue-100';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
