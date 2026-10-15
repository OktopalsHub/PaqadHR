import type { ReactNode } from 'react';
import { OnboardingHeader } from '@/features/onboarding/components/onboarding-header';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <ForceLightTheme>
      <div className="relative min-h-svh overflow-x-hidden overflow-y-auto bg-white sm:bg-[linear-gradient(135deg,#edf8f3_0%,#f8fbfa_46%,#ebf7f1_100%)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_top_left,rgba(0,160,112,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,143,101,0.08),transparent_24%)]"
        />

        <div className="relative z-10 flex min-h-svh flex-col px-3 pb-4 pt-3 sm:px-4 sm:pb-5 sm:pt-4 lg:px-6 lg:pb-7 lg:pt-5">
          <header className="mx-auto w-full max-w-[1480px]">
            <OnboardingHeader />
          </header>

          <main className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 items-stretch pb-2 pt-4 sm:pb-3 sm:pt-5 lg:pb-4">
            {children}
          </main>
        </div>
      </div>
    </ForceLightTheme>
  );
}
