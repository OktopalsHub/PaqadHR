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
        hostname: 'pub-aa92a7d639fd40aab9505685d7e75215.r2.dev',
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
