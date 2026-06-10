'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NAV_LINKS, PORTALS } from '@/lib/site';
import { cn } from '@/lib/utils';

const PORTAL_LINKS = [
  { label: 'Patient sign in', href: PORTALS.patient, desc: 'Track your care & appointments' },
  { label: 'Prosthetist & Orthotist', href: PORTALS.prosthetistOrthotist, desc: 'P&O clinical workspace + 3D editor' },
  { label: 'Physiotherapy', href: PORTALS.physiotherapy, desc: 'Physio clinical workspace' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="container flex items-center justify-between h-16">
        <Logo size={42} />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'relative transition-colors hover:text-slate-900',
                pathname === l.href && 'text-slate-900'
              )}
            >
              {l.label}
              {pathname === l.href && (
                <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 dynax-gradient rounded-full" />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <div
            className="relative"
            onMouseEnter={() => setPortalOpen(true)}
            onMouseLeave={() => setPortalOpen(false)}
          >
            <button className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              Sign in <ChevronDown className="w-4 h-4" />
            </button>
            {portalOpen && (
              <div className="absolute right-0 top-full pt-2 w-72">
                <div className="rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/60 p-2 animate-fade-in">
                  {PORTAL_LINKS.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      className="block rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <span className="block text-sm font-semibold text-slate-800">{p.label}</span>
                      <span className="block text-xs text-slate-500">{p.desc}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link
            href="/auth/register?role=patient"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-dynax-blue text-white hover:bg-dynax-blue-dark transition-colors shadow-sm shadow-blue-200"
          >
            Get started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 -mr-2 text-slate-700"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white animate-fade-in">
          <div className="container py-4 space-y-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-2 py-2.5 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-100">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Portals
              </p>
              {PORTAL_LINKS.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  className="block px-2 py-2.5 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <Link
              href="/auth/register?role=patient"
              onClick={() => setOpen(false)}
              className="block text-center mt-3 py-3 rounded-xl bg-dynax-blue text-white font-semibold"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
