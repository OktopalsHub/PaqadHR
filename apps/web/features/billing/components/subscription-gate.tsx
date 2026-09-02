'use client';

import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useEffect } from 'react';
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
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" aria-hidden="true" />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Securing your workspace
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Checking your subscription</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We’re confirming your workspace access and plan before opening your dashboard. This
          usually takes just a moment.
        </p>
        <div className="mt-7 space-y-3 text-left" aria-hidden="true">
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-2 w-4/5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
          <div className="h-2 w-3/5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
