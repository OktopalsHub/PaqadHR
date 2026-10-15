import { type ReactNode, Suspense } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { SubscribeGate } from '@/features/billing/components/subscribe-gate';
import { OnboardingHeader } from '@/features/onboarding/components/onboarding-header';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function SubscribeLayout({ children }: { children: ReactNode }) {
  return (
    <ForceLightTheme>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center p-6">
            <LoadingBlock />
          </div>
        }
      >
        <SubscribeGate>
          <header className="border-b border-border">
            <OnboardingHeader />
          </header>
          <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">{children}</main>
        </SubscribeGate>
      </Suspense>
    </ForceLightTheme>
  );
}
