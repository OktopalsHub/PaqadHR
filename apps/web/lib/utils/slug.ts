import { RESERVED_ROUTE_SEGMENTS } from '@/lib/navigation/tenant-routes';

const SLUG_MAX_LENGTH = 25;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH);
}

export function isSlugFormatValid(slug: string): boolean {
  return slug.length >= 2 && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

export function isSlugReserved(slug: string): boolean {
  return RESERVED_ROUTE_SEGMENTS.has(slug);
}

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/`;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.endsWith('/') ? configured : `${configured}/`;
  }
  return '/';
}
