import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/layout/Providers';
import TopProgress from '@/components/layout/TopProgress';
import AuthInitializer from '@/components/layout/AuthInitializer';
import ServiceWorkerRegistrar from '@/components/layout/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'DynaX — Rehabilitation & Prosthetic Care', template: '%s | DynaX' },
  description: 'Advanced rehabilitation and prosthetic care platform connecting patients, professionals, and clinics.',
  // Deliberately no `manifest` here — dynax.app is the marketing site and must
  // not be installable. Each product layout declares its own manifest so the
  // installed app is DynaX Pro / Care / Physio / DynaXcan, never plain "DynaX".
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
  openGraph: {
    type: 'website',
    title: 'DynaX Platform',
    description: 'Advanced rehabilitation and prosthetic care platform',
    siteName: 'DynaX by Dynalimb',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <TopProgress />
        <AuthInitializer />
        <ServiceWorkerRegistrar />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
