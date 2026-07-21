import { fetchBillingStatus } from '@/lib/api/subscriptions';
import {
  type AuthDestination,
  authDestinationToPath,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { subscribePageUrl } from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';

function tenantSlugFromDashboardPath(path: string): string | null {
  try {
    const url = new URL(
      path,
      typeof window !== 'undefined' ? window.location.origin : 'http://local',
    );
    const hostParts = url.hostname.split('.');
    // subdomain tenants: acme.dev.paqadhr.com
    if (hostParts.length >= 3 && hostParts[0] && hostParts[0] !== 'www') {
      return hostParts[0];
    }
    const segment = url.pathname.split('/').filter(Boolean)[0];
    return segment || null;
  } catch {
    return null;
  }
}

/**
 * After auth, send unpaid / no-plan workspaces straight to /subscribe
 * instead of flashing the private app and relying only on SubscriptionGate.
 */
export async function resolvePostAuthHref(opts: {
  tenants: Tenant[];
  redirect?: string | null;
}): Promise<string> {
  const destination = resolveAuthDestination({
    isAuthenticated: true,
    tenants: opts.tenants,
    redirect: opts.redirect,
  });

  if (destination.type !== 'dashboard') {
    return authDestinationToPath(destination);
  }

  const slugHint = tenantSlugFromDashboardPath(destination.path);
  const tenant =
    opts.tenants.find((entry) => entry.slug === slugHint) ??
    (opts.tenants.length === 1 ? opts.tenants[0] : null);

  if (!tenant?.id || !tenant.slug) {
    return authDestinationToPath(destination);
  }

  try {
    const billing = await fetchBillingStatus(tenant.id);
    if (billing.paymentsEnabled && billing.needsPayment) {
      return subscribePageUrl({ workspace: tenant.slug });
    }
  } catch {
    // SubscriptionGate on the private layout is the fallback.
  }

  return authDestinationToPath(destination);
}

export function goToHref(href: string, navigate: (path: string) => void): void {
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

export type { AuthDestination };
