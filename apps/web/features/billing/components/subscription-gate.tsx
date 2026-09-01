'use client';

import { useRouter } from 'next/navigation';
import { memo, useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading-block';
import { subscribePagePath } from '@/lib/navigation/tenant-routes';
import { useAuth } from '@/providers/auth-provider';
import { useTenant } from '@/providers/tenant-provider';

export const SubscriptionGate = memo(function SubscriptionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { tenant } = useTenant();
  const {
    featureGatingEnabled,
    paymentsEnabled,
    hasResolvedSession,
    isLoading: authLoading,
  } = useAuth();

  const shouldBlockPayment =
    hasResolvedSession &&
    Boolean(featureGatingEnabled) &&
    Boolean(paymentsEnabled) &&
    Boolean(tenant?.needsPayment);

  useEffect(() => {
    if (authLoading || !hasResolvedSession || !tenant?.slug) return;
    if (shouldBlockPayment) {
      router.push(subscribePagePath({ workspace: tenant.slug }));
    }
  }, [authLoading, hasResolvedSession, shouldBlockPayment, tenant?.slug, router]);

  if (authLoading || !hasResolvedSession) {
    return <LoadingSpinner />;
  }

  if (shouldBlockPayment) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
});
