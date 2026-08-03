import type { Metadata } from 'next';
import InstallButton from '@/components/pwa/InstallButton';
import InstallBanner from '@/components/pwa/InstallBanner';
import WalkthroughTour from '@/components/onboarding/WalkthroughTour';

// DynaX Care — the patient portal installs as its own PWA. Declaring
// `manifest` here overrides the root manifest for every
// /dashboard/patient/* route.
// iOS ignores the manifest name for Add to Home Screen — it reads
// apple-mobile-web-app-title, falling back to the document title. Without both
// of these the app installs as "DynaX" on iOS no matter what the manifest says.
// iOS ignores the manifest icons array too — the home-screen icon comes from
// apple-touch-icon, so without this override Care would install with the shared
// DynaX mark. Declaring `icon` alongside it keeps the browser tab consistent.
export const metadata: Metadata = {
  manifest: '/care-manifest.json',
  title: 'DynaX Care',
  appleWebApp: {
    capable: true,
    title: 'DynaX Care',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/care-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/care-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/care-icon-512.png', sizes: '512x512', type: 'image/png' },
  },
};

export default function PatientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InstallBanner
        expectedHost="care.dynax.app"
        productName="DynaX Care"
        title="Install DynaX Care"
        body="Get DynaX Care on your phone for easy access to your appointments, care plans and messages."
      />
      {children}
      <WalkthroughTour role="patient" />
      {/* In the layout so it survives navigation — see the note in the
          professional layout. */}
      <InstallButton expectedHost="care.dynax.app" className="fixed bottom-4 right-4 z-40" />
    </>
  );
}
