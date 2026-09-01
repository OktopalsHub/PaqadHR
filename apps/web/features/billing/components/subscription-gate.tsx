'use client';

import { useRouter } from 'next/navigation';
import { memo, useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { useBillingOverview } from '@/hooks/queries/use-billing';
import { subscribePagePath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export const SubscriptionGate = memo(function SubscriptionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { tenant } = useTenant();
  const { data: billing, isLoading } = useBillingOverview();

  const shouldBlockPayment =
    Boolean(billing?.featureGatingEnabled) &&
    Boolean(billing?.paymentsEnabled) &&
    billing?.needsPayment === true;

  // Unpaid workspaces are sent to /subscribe before any private route (including settings) renders.
  useEffect(() => {
    if (isLoading || !tenant?.slug) return;
    if (shouldBlockPayment) {
      router.push(subscribePagePath({ workspace: tenant.slug }));
    }
  }, [isLoading, shouldBlockPayment, tenant?.slug, router]);

  if (isLoading) {
    // Billing validation should not replace an otherwise usable page with a
    // full-screen spinner. If payment is required, the effect redirects once
    // the server response arrives.
    return <>{children}</>;
  }

  if (shouldBlockPayment) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
});
