import type { MetadataRoute } from 'next';
import { COMPANY } from '@/lib/constants/company';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/signin',
        '/signup',
        '/onboarding/',
        '/app/',
        '/dashboard/',
      ],
    },
    sitemap: `${COMPANY.website}/sitemap.xml`,
    host: COMPANY.website,
  };
}
