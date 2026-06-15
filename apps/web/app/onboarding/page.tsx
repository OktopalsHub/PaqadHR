import { OnboardingGate } from '@/features/onboarding/components/onboarding-gate';
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard';

export default function OnboardingPage() {
  return (
    <OnboardingGate>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-2 text-muted-foreground">
            A few details to get your team up and running.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </OnboardingGate>
  );
}
