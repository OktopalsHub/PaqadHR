import { Suspense } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { SubscribePage } from '@/features/billing/components/subscribe-page';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

export default function MarketingSubscribePage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SubscribePage variant="marketing" />
    </Suspense>
  );
}
