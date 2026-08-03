import type { Metadata } from 'next';

// DynaX Physio installs as its own PWA. Wired to the physiotherapy portal for
// now — physiotherapists still work in /dashboard/professional, which is
// outside this scope, until a dedicated physio dashboard route exists.
// iOS ignores the manifest icons array too — the home-screen icon comes from
// apple-touch-icon, so without this override Physio would install with the
// shared DynaX mark. `icon` keeps the browser tab consistent.
export const metadata: Metadata = {
  manifest: '/physio-manifest.json',
  title: 'DynaX Physio',
  appleWebApp: {
    capable: true,
    title: 'DynaX Physio',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/physio-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/physio-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/physio-icon-512.png', sizes: '512x512', type: 'image/png' },
  },
};

// No install affordance here: this is an auth portal, not a dashboard. The
// manifest stays so a physio who installs from inside the product still gets
// "DynaX Physio" — the prompt belongs on the dashboards.
export default function PhysiotherapyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
