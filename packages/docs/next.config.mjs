/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — the docs site is a static asset bundle hosted on a free
  // tier (Vercel/Netlify/GitHub Pages), per the root README's Zero-Infra
  // Guarantee. No server-rendering, no API routes here.
  output: 'export',
  // Mounted at /docs alongside the landing page's own static build — every
  // route and internal asset path needs this prefix baked in at build time.
  basePath: '/docs',
};

export default nextConfig;
