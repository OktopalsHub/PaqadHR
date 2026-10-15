import { isOnTenantSubdomain } from '@/lib/navigation/tenant-routes';

/**
 * Marketing + credential pages where anonymous 401s are expected.
 * Hard-redirecting to /signin here remounts forms and breaks typing.
 */
export function isPublicAuthOrMarketingPath(pathname: string): boolean {
  if (typeof window !== 'undefined' && isOnTenantSubdomain()) {
    // Tenant host `/` is the app dashboard — only careers is public.
    return /^\/careers\/?$/.test(pathname);
  }

  return (
    pathname === '/' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/contact' ||
    pathname === '/dpa' ||
    pathname === '/google/complete' ||
    pathname === '/signin' ||
    pathname === '/signup' ||
    pathname === '/reset-password' ||
    /^\/[^/]+\/careers\/?$/.test(pathname)
  );
}

/** Routes that never need an auth/session API probe on first paint. */
export function skipsSessionBootstrap(pathname: string): boolean {
  if (typeof window !== 'undefined' && isOnTenantSubdomain()) {
    // On tenant hosts the dashboard is `/`; only public tenant pages skip session.
    return /^\/careers\/?$/.test(pathname);
  }

  return (
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/contact' ||
    pathname === '/dpa' ||
    pathname === '/google/complete' ||
    pathname === '/signup' ||
    pathname === '/reset-password' ||
    /^\/[^/]+\/careers\/?$/.test(pathname)
  );
}
