/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output bundles Node.js server — works for both cloud and Electron
  output: 'standalone',
  images: { unoptimized: true },
};

module.exports = nextConfig;
