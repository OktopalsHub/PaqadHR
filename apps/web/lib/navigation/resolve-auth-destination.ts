import {
  authPageUrl,
  captureAuthReturnTo,
  getPostAuthPath,
  marketingOrigin,
} from '@/lib/navigation/tenant-routes';
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
      return authPageUrl('/signin', destination.redirect);
    case 'onboarding':
      return `${marketingOrigin()}/onboarding`;
    case 'dashboard':
      return destination.path;
  }
}

export function isExternalAuthHref(href: string): boolean {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    if (typeof window === 'undefined') return true;
    try {
      return new URL(href).origin !== window.location.origin;
    } catch {
      return true;
    }
  }
  return false;
}

export function goToAuthDestination(
  destination: AuthDestination,
  navigate: (path: string) => void,
): void {
  const href = authDestinationToPath(destination);
  if (
    typeof window !== 'undefined' &&
    (href.startsWith('http://') || href.startsWith('https://'))
  ) {
    try {
      const url = new URL(href);
      if (url.origin === window.location.origin) {
        navigate(`${url.pathname}${url.search}`);
        return;
      }
    } catch {
      window.location.assign(href);
      return;
    }
    window.location.assign(href);
    return;
  }
  navigate(href);
}

export { captureAuthReturnTo };
