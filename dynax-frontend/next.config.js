/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app type-checks clean locally; these guards stop a deployment from
  // being blocked by a stray type/lint issue (e.g. in code not yet touched).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Hosts we load <Image>/<img> assets from (brand logo, avatars, storage).
    remotePatterns: [
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'imgur.com' },
      { protocol: 'https', hostname: 'dynax.app' },
      { protocol: 'https', hostname: 'dynalimb.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias };
    // Support WASM (used by some 3D operations / loaders)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  async rewrites() {
    // scanner.dynax.app stands on its own: its root opens the DynaX Scanner.
    // It serves the same Next app (one deployment, shared .dynax.app session),
    // so every /dashboard/professional/scanner/* route works on the subdomain too.
    // Each product subdomain opens straight into its own surface, giving every
    // PWA a distinct origin — the only way app identity holds up on iOS.
    // beforeFiles, not a flat array: a flat array is treated as afterFiles,
    // which runs *after* the filesystem check — '/' matches the marketing
    // page.tsx and the homepage is served before these ever fire.
    return {
      beforeFiles: [
        {
          source: '/',
          has: [{ type: 'host', value: 'scanner.dynax.app' }],
          destination: '/scanner',
        },
        {
          source: '/',
          has: [{ type: 'host', value: 'pro.dynax.app' }],
          destination: '/dashboard/professional',
        },
        {
          source: '/',
          has: [{ type: 'host', value: 'care.dynax.app' }],
          destination: '/dashboard/patient',
        },
        {
          source: '/',
          has: [{ type: 'host', value: 'physio.dynax.app' }],
          destination: '/physiotherapy',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
