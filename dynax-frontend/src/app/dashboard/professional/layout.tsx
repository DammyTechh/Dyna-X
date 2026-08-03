import type { Metadata } from 'next';
import InstallButton from '@/components/pwa/InstallButton';
import InstallBanner from '@/components/pwa/InstallBanner';
import WalkthroughTour from '@/components/onboarding/WalkthroughTour';

// DynaX Pro — the P&O professional workspace installs as its own PWA.
// Declaring `manifest` here overrides the root manifest for every
// /dashboard/professional/* route.
// iOS ignores the manifest name for Add to Home Screen — it reads
// apple-mobile-web-app-title, falling back to the document title. Without both
// of these the app installs as "DynaX" on iOS no matter what the manifest says.
// iOS ignores the manifest icons array too — the home-screen icon comes from
// apple-touch-icon, so without this override Pro would install with the shared
// DynaX mark. Declaring `icon` alongside it keeps the browser tab consistent.
export const metadata: Metadata = {
  manifest: '/pro-manifest.json',
  title: 'DynaX Pro',
  appleWebApp: {
    capable: true,
    title: 'DynaX Pro',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/pro-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/pro-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/pro-icon-512.png', sizes: '512x512', type: 'image/png' },
  },
};

export default function ProfessionalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InstallBanner
        expectedHost="pro.dynax.app"
        productName="DynaX Pro"
        title="Install DynaX Pro"
        body="Add DynaX Pro to your home screen for faster access to your clinical workspace — works offline and feels like a native app."
      />
      {children}
      <WalkthroughTour role="professional" />
      {/* Lives in the layout, not a page: beforeinstallprompt fires per page
          load, so an install affordance pinned to one page disappears the
          moment the user navigates. Here it persists for the whole session. */}
      <InstallButton expectedHost="pro.dynax.app" className="fixed bottom-4 right-4 z-40" />
    </>
  );
}
