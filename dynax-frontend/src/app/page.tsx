import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg dynax-gradient flex items-center justify-center">
              <span className="text-white font-display font-bold text-sm">DX</span>
            </div>
            <span className="font-display font-bold text-xl text-slate-900">DynaX</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
            <Link href="/products" className="hover:text-slate-900 transition-colors">Products</Link>
            <Link href="/patient-care" className="hover:text-slate-900 transition-colors">Patient Care</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-dynax-blue text-white hover:bg-dynax-blue-dark transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Trusted by rehabilitation professionals across Africa
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-slate-900 leading-tight mb-6 animate-slide-up">
            Advanced Care for
            <span className="dynax-gradient-text block">Every Patient</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in">
            DynaX connects patients with rehabilitation professionals, prosthetists, and therapists — 
            with AI-powered tools, 3D scan sharing, and flexible payment through TheraPay.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 animate-slide-up">
            <Link
              href="/auth/register?role=patient"
              className="px-8 py-3.5 rounded-xl bg-dynax-blue text-white font-semibold text-base hover:bg-dynax-blue-dark transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5"
            >
              I'm a Patient →
            </Link>
            <Link
              href="/auth/register?role=professional"
              className="px-8 py-3.5 rounded-xl border-2 border-slate-200 text-slate-800 font-semibold text-base hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              I'm a Professional
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-50">
        <div className="container">
          <h2 className="font-display text-4xl font-bold text-center text-slate-900 mb-4">
            One Platform. Every Specialty.
          </h2>
          <p className="text-slate-600 text-center max-w-xl mx-auto mb-16">
            From physiotherapy to prosthetics — DynaX brings all rehabilitation specialties under one roof.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4 text-2xl`}>
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-lg text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container max-w-4xl">
          <h2 className="font-display text-4xl font-bold text-center text-slate-900 mb-16">
            How DynaX Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="w-14 h-14 rounded-full dynax-gradient text-white font-display font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {i + 1}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-slate-600 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 dynax-gradient">
        <div className="container text-center text-white">
          <h2 className="font-display text-4xl font-bold mb-4">Ready to transform rehabilitation?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join thousands of patients and professionals on DynaX.</p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-dynax-blue font-bold text-base hover:bg-blue-50 transition-colors shadow-xl"
          >
            Create Your Free Account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg dynax-gradient flex items-center justify-center">
                <span className="text-white font-bold text-xs">DX</span>
              </div>
              <span className="font-display font-bold text-white">DynaX</span>
              <span className="text-slate-600">by Dynalimb Technologies</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-sm text-center">
            © {new Date().getFullYear()} Dynalimb Technologies. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  { title: 'Physiotherapy', icon: '🦴', color: 'bg-blue-50', desc: 'SOAP notes, care plans, exercise programs, and session scheduling for physio professionals.' },
  { title: 'Prosthetics & Orthotics', icon: '🦾', color: 'bg-teal-50', desc: '3D scan editor, parametric measurements, device status tracking from draft to delivery.' },
  { title: 'Mental Health', icon: '🧠', color: 'bg-purple-50', desc: 'Mood tracking, digital journals, session booking, and confidential clinical notes.' },
  { title: 'Speech Therapy', icon: '🗣️', color: 'bg-orange-50', desc: 'Exercise libraries, progress trackers, and goal management for speech therapists.' },
  { title: 'Occupational Therapy', icon: '🤝', color: 'bg-green-50', desc: 'ADL assessments, home exercise programs, and collaborative care planning.' },
  { title: 'TheraPay', icon: '💳', color: 'bg-pink-50', desc: 'Flexible payment plans — session, bundle, subscription, or installment — built for healthcare.' },
];

const STEPS = [
  { title: 'Register & Connect', desc: 'Create your account and connect with your professional via their unique DX-PIN code.' },
  { title: 'Start Your Care Journey', desc: 'Book appointments, receive care plans, log sessions, and track your rehabilitation progress.' },
  { title: 'Collaborate & Grow', desc: 'Professionals share 3D scans, notes, and progress across your multidisciplinary team.' },
];
