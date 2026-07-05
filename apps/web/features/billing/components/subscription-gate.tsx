'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { useBillingStatus } from '@/hooks/queries/use-billing';
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

  const shouldBlock =
    !isExempt && billing?.featureGatingEnabled && billing.needsPayment && billing.paymentsEnabled;

  useEffect(() => {
    if (isLoading || !shouldBlock || !tenant?.slug) return;
    router.replace(`/${tenant.slug}/subscribe`);
  }, [isLoading, shouldBlock, tenant?.slug, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (shouldBlock) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingBlock />
      </div>
    );
  }

  return <>{children}</>;
}
