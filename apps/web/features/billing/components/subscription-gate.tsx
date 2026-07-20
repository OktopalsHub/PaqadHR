'use client';

import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { useBillingStatus } from '@/hooks/queries/use-billing';
import { subscribePageUrl } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();
  const { data: billing, isLoading } = useBillingStatus();

  const needsTrialSetup =
    billing?.featureGatingEnabled && !billing.entitled && !billing.subscription;

  const shouldBlockPayment =
    billing?.featureGatingEnabled && billing.needsPayment && billing.paymentsEnabled;

  useEffect(() => {
    if (isLoading || !tenant?.slug) return;
    if (needsTrialSetup) {
      window.location.assign(subscribePageUrl({ welcome: true, workspace: tenant.slug }));
      return;
    }
    if (shouldBlockPayment) {
      window.location.assign(subscribePageUrl({ workspace: tenant.slug }));
    }
  }, [isLoading, needsTrialSetup, shouldBlockPayment, tenant?.slug]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (needsTrialSetup || shouldBlockPayment) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
