import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-avatar',
      '@radix-ui/react-popover',
      'recharts',
      'date-fns',
      'embla-carousel-react',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'posthog-js',
      'axios',
      'zod',
      '@tanstack/react-query',
    ],
  },
  async headers() {
    return [
      {
        source: '/version.json',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'testflight.tremendous.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.tremendous.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.giftrocket.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'paqadhr.com',
        pathname: '/logo-*.png',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
