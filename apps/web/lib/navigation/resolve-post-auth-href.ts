import { fetchBillingStatus } from '@/lib/api/subscriptions';
import {
  type AuthDestination,
  authDestinationToPath,
  resolveAuthDestination,
} from '@/lib/navigation/resolve-auth-destination';
import { subscribePageUrl, tenantUrl } from '@/lib/navigation/tenant-routes';
import type { Tenant } from '@/lib/schemas/tenant';

function tenantSlugFromDashboardPath(path: string): string | null {
  try {
    const url = new URL(
      path,
      typeof window !== 'undefined' ? window.location.origin : 'http://local',
    );
    const hostParts = url.hostname.split('.');
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
 *
 * If the user belongs to multiple tenants, allow access as long as at
 * least one tenant does not need payment.
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

  const billingChecks = await Promise.allSettled(
    opts.tenants.map((tenant) =>
      fetchBillingStatus(tenant.id)
        .then((billing) => ({ tenant, billing }))
        .catch(() => null),
    ),
  );

  const paidBilling: Array<{
    tenant: Tenant;
    billing: { paymentsEnabled: boolean; needsPayment: boolean };
  }> = [];
  for (const result of billingChecks) {
    if (result.status === 'fulfilled' && result.value) {
      const { tenant, billing } = result.value;
      if (!(billing.paymentsEnabled && billing.needsPayment)) {
        paidBilling.push({ tenant, billing });
      }
    }
  }

  const sortedPaid = paidBilling.sort((a, b) => {
    if (a.tenant.slug === slugHint) return -1;
    if (b.tenant.slug === slugHint) return 1;
    return 0;
  });

  if (sortedPaid.length > 0) {
    return tenantUrl(sortedPaid[0].tenant.slug, '/');
  }

  const targetTenant = opts.tenants.find((entry) => entry.slug === slugHint) ?? opts.tenants[0];
  if (targetTenant?.slug) {
    return subscribePageUrl({ workspace: targetTenant.slug });
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
