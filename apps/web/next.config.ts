import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  experimental: {
    // Keep large icon/chart packages to the modules each page imports.
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', '@base-ui/react', 'radix-ui'],
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
      {
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/llms.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/icon.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Social crawlers fetch this once per share target; it is a static 1200x630
        // render with no per-request nonce, so it is safe to cache at the edge.
        source: '/opengraph-image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  images: {
    // Serve smaller AVIF/WebP variants before falling back to the source format.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86_400,
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
