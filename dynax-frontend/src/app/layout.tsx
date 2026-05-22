import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/layout/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'DynaX — Rehabilitation & Prosthetic Care', template: '%s | DynaX' },
  description: 'Advanced rehabilitation and prosthetic care platform connecting patients, professionals, and clinics.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/dynax-logo-192.png',
    apple: '/icons/dynax-logo-512.png',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
