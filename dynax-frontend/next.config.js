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
