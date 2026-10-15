'use client';

import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BillingSection } from '@/features/settings/components/billing-section';
import { useBillingStatus } from '@/hooks/queries/use-billing';

export function SettingsBillingTab() {
  const { isLoading, isError, error } = useBillingStatus();

  if (isLoading) {
    return <LoadingBlock />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load billing</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <ContentCard title="Billing">
        <BillingSection />
      </ContentCard>
    </div>
  );
}
