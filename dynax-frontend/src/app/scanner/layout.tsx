import type { Metadata, Viewport } from 'next';

// Wraps every /scanner route (product shell and login) to give scanner.dynax.app
// its own manifest, title and theme. The service worker is registered once in
// the root layout, which covers these routes too.
export const metadata: Metadata = {
  title: { default: 'DynaXcan', template: '%s | DynaXcan' },
  description: 'Capture, reconstruct and review 3D scans.',
  // DynaXcan installs as its own PWA — this overrides the root manifest for
  // every /scanner/* route, including the scanner's own login screen.
  manifest: '/scanner-manifest.json',
  appleWebApp: {
    capable: true,
    title: 'DynaXcan',
    statusBarStyle: 'black-translucent',
  },
  // iOS ignores the manifest icons array — the home-screen icon comes from
  // apple-touch-icon, so without this override DynaXcan would install with the
  // shared DynaX mark. `icon` keeps the browser tab consistent.
  icons: {
    icon: [
      { url: '/icons/scanner-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/scanner-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/scanner-icon-512.png', sizes: '512x512', type: 'image/png' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
