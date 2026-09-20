import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;

// Enables the local `next dev` server to access Cloudflare bindings (D1, etc.)
// without needing `wrangler dev`. No top-level await here — Next's config
// loader requires this file as CJS, which rejects top-level await entirely.
if (process.env.NODE_ENV !== 'production') {
  import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}
