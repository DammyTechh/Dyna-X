import Link from 'next/link';
import { Phone, Mail, MapPin } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { SITE, NAV_LINKS, PORTALS } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Logo light size={34} />
            <p className="mt-4 text-sm leading-relaxed max-w-xs">{SITE.tagline}</p>
            <p className="mt-4 text-xs text-slate-500">
              by {SITE.company}
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-white font-display font-semibold text-sm mb-4">Explore</h4>
            <ul className="space-y-2.5 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="text-white font-display font-semibold text-sm mb-4">Portals</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href={PORTALS.patient} className="hover:text-white transition-colors">Patient</Link></li>
              <li><Link href={PORTALS.prosthetistOrthotist} className="hover:text-white transition-colors">Prosthetist &amp; Orthotist</Link></li>
              <li><Link href={PORTALS.physiotherapy} className="hover:text-white transition-colors">Physiotherapy</Link></li>
              <li><Link href={PORTALS.admin} className="hover:text-white transition-colors">Admin</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-display font-semibold text-sm mb-4">Get in touch</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={SITE.phoneHref} className="flex items-center gap-2.5 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 text-dynax-teal" /> {SITE.phone}
                </a>
              </li>
              <li>
                <a href={SITE.emailHref} className="flex items-center gap-2.5 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 text-dynax-teal" /> {SITE.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-dynax-teal" /> {SITE.address}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} {SITE.company}. All rights reserved.</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
