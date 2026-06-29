import type { ReactNode } from 'react';
import { OnboardingHeader } from '@/features/onboarding/components/onboarding-header';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <ForceLightTheme>
      <header className="border-b border-border">
        <OnboardingHeader />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">{children}</main>
    </ForceLightTheme>
  );
}
