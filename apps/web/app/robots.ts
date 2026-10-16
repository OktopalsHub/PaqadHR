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
        '/onboarding',
        '/app',
        '/dashboard',
        '/*/activity',
        '/*/analytics',
        '/*/attendance',
        '/*/calendar',
        '/*/employees',
        '/*/integrations',
        '/*/leaves',
        '/*/logs',
        '/*/payroll',
        '/*/recruitment',
        '/*/rewards',
        '/*/schedule',
        '/*/settings',
        '/*/shoutouts',
        '/*/subscribe',
        '/*/teams',
      ],
    },
    sitemap: `${COMPANY.website}/sitemap.xml`,
    host: COMPANY.website,
  };
}
