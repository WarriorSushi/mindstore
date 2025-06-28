/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is now stable in Next.js 15, no experimental config needed
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  reactStrictMode: true,
  experimental: {
    // Removed optimizeCss as it's causing build issues
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig 