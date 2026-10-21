import type { MetadataRoute } from 'next';
import { COMPANY } from '@/lib/constants/company';
import { MARKETING_PAGES } from '@/lib/constants/marketing-pages';

/**
 * Every public page, not just the legal documents. A sitemap with six URLs told
 * crawlers the site had six pages; this list is the actual marketing surface.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PAGES.map((page) => ({
    url: new URL(page.path, COMPANY.website).toString(),
    lastModified: new Date(`${page.updated}T00:00:00Z`),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
