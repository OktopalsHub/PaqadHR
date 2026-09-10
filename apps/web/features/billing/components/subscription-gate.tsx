'use client';

import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useEffect } from 'react';
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

  const isLoading = authLoading || !hasResolvedSession;

  const shouldBlockPayment =
    hasResolvedSession &&
    Boolean(featureGatingEnabled) &&
    Boolean(paymentsEnabled) &&
    Boolean(tenant?.needsPayment);

  useEffect(() => {
    if (isLoading || !tenant?.slug) return;
    if (shouldBlockPayment) {
      router.push(subscribePagePath({ workspace: tenant.slug }));
    }
  }, [isLoading, shouldBlockPayment, tenant?.slug, router]);

  if (isLoading) {
    // Keep the app shell and route-level loading states visible while billing
    // revalidates. The server remains the authority for protected API data.
    return <>{children}</>;
  }

  if (shouldBlockPayment) {
    return <BillingValidationScreen />;
  }

  return <>{children}</>;
});

function BillingValidationScreen() {
  return (
    <div
      className="flex min-h-svh items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-6 py-12"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-foreground">
          <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
          Checking subscription…
        </div>
      </div>
    </div>
  );
}
