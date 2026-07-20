import { getPostAuthPath } from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';

export type AuthDestination =
  | { type: 'signin'; redirect?: string }
  | { type: 'onboarding' }
  | { type: 'dashboard'; path: string };

export function resolveAuthDestination(opts: {
  isAuthenticated: boolean;
  tenants: Tenant[];
  redirect?: string | null;
}): AuthDestination {
  const { isAuthenticated, tenants, redirect } = opts;

  if (!isAuthenticated) {
    return redirect ? { type: 'signin', redirect } : { type: 'signin' };
  }

  if (tenants.length === 0) {
    return { type: 'onboarding' };
  }

  return { type: 'dashboard', path: getPostAuthPath(tenants, redirect) };
}

export function authDestinationToPath(destination: AuthDestination): string {
  switch (destination.type) {
    case 'signin':
      if (destination.redirect) {
        return `/signin?redirect=${encodeURIComponent(destination.redirect)}`;
      }
      return '/signin';
    case 'onboarding':
      return '/onboarding';
    case 'dashboard':
      return destination.path;
  }
}

export function isExternalAuthHref(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://');
}

export function goToAuthDestination(
  destination: AuthDestination,
  navigate: (path: string) => void,
): void {
  const href = authDestinationToPath(destination);
  if (isExternalAuthHref(href)) {
    window.location.assign(href);
    return;
  }
  navigate(href);
}
