import type { MetadataRoute } from 'next';
import { COMPANY } from '@/lib/constants/company';

const publicPaths = ['/', '/privacy', '/terms', '/contact', '/dpa', '/cookies'];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: new URL(path, COMPANY.website).toString(),
    changeFrequency: path === '/' ? 'weekly' : 'yearly',
    priority: path === '/' ? 1 : 0.4,
  }));
}
