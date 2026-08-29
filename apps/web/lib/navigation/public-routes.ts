import { isOnTenantSubdomain } from '@/lib/navigation/tenant-routes';

/** Routes that never need an auth/session API probe on first paint. */
export function skipsSessionBootstrap(pathname: string): boolean {
  if (typeof window !== 'undefined' && isOnTenantSubdomain()) {
    // On tenant hosts the dashboard is `/`; only public tenant pages skip session.
    return /^\/careers\/?$/.test(pathname);
  }

  return (
    pathname === '/' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/subprocessors' ||
    pathname === '/dpa' ||
    pathname === '/google/complete' ||
    pathname === '/signin' ||
    pathname === '/signup' ||
    pathname === '/reset-password' ||
    /^\/[^/]+\/careers\/?$/.test(pathname)
  );
}
