'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { useBillingStatus } from '@/hooks/queries/use-billing';
import { tenantPath } from '@/lib/navigation/tenant-routes';
import { useTenant } from '@/providers/tenant-provider';

const EXEMPT_PATH_SUFFIXES = ['/subscribe'];

function isBillingSettingsPath(pathname: string, tab: string | null) {
  return pathname.includes('/settings') && tab === 'billing';
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const { tenant } = useTenant();
  const { data: billing, isLoading } = useBillingStatus();

  const isExempt =
    EXEMPT_PATH_SUFFIXES.some((suffix) => pathname.endsWith(suffix)) ||
    isBillingSettingsPath(pathname, tab);

  const needsTrialSetup =
    !isExempt && billing?.featureGatingEnabled && !billing.entitled && !billing.subscription;

  const shouldBlockPayment =
    !isExempt && billing?.featureGatingEnabled && billing.needsPayment && billing.paymentsEnabled;

  useEffect(() => {
    if (isLoading || !tenant?.slug) return;
    if (needsTrialSetup) {
      router.replace(tenantPath(tenant.slug, 'subscribe?welcome=1'));
      return;
    }
    if (shouldBlockPayment) {
      router.replace(tenantPath(tenant.slug, 'subscribe'));
    }
  }, [isLoading, needsTrialSetup, shouldBlockPayment, tenant?.slug, router]);

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
