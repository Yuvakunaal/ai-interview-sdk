/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — the docs site is a static asset bundle hosted on a free
  // tier (Vercel/Netlify/GitHub Pages), per the root README's Zero-Infra
  // Guarantee. No server-rendering, no API routes here.
  output: 'export',
};

export default nextConfig;
