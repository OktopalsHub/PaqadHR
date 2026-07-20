import { isReservedTenantSlug } from '@/lib/constants/reserved-tenant-slugs';
import {
  getWorkspaceUrlPrefix,
  getWorkspaceUrlSuffix,
  isSubdomainTenantsEnabled,
  tenantHostPreview,
} from '@/lib/navigation/tenant-routes';

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
  return isReservedTenantSlug(slug);
}

export function getAppBaseUrl(): string {
  return getWorkspaceUrlPrefix();
}

export function getAppUrlSuffix(): string {
  return getWorkspaceUrlSuffix();
}

export function formatWorkspaceUrl(slug: string): string {
  if (isSubdomainTenantsEnabled()) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}//${tenantHostPreview(slug)}`;
  }
  return `${getWorkspaceUrlPrefix()}${slug}`;
}
