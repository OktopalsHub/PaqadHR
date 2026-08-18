'use client';

import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { useBillingStatus } from '@/hooks/queries/use-billing';
import { subscribePageUrl } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();
  const { data: billing, isLoading } = useBillingStatus();

  const shouldBlockPayment =
    Boolean(billing?.featureGatingEnabled) &&
    Boolean(billing?.paymentsEnabled) &&
    billing?.needsPayment === true;

  // Unpaid workspaces are sent to /subscribe before any private route (including settings) renders.
  useEffect(() => {
    if (isLoading || !tenant?.slug) return;
    if (shouldBlockPayment) {
      window.location.assign(subscribePageUrl({ workspace: tenant.slug }));
    }
  }, [isLoading, shouldBlockPayment, tenant?.slug]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (shouldBlockPayment) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
