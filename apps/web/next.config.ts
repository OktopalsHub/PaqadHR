import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  async redirects() {
    return [{ source: '/subprocessors', destination: '/privacy', permanent: true }];
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
