import { Suspense } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { SubscribePage } from '@/features/billing/components/subscribe-page';

export default function MarketingSubscribePage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SubscribePage variant="marketing" />
    </Suspense>
  );
}
