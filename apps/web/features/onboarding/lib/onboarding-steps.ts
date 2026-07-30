import { Building2, ClipboardList, type LucideIcon, UserRound, WalletCards } from 'lucide-react';

export const ONBOARDING_STEPS = ['Company', 'You', 'Plan', 'Review'] as const;

export type OnboardingStepLabel = (typeof ONBOARDING_STEPS)[number];

export type OnboardingStepDetail = {
  label: OnboardingStepLabel;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const ONBOARDING_STEP_DETAILS: OnboardingStepDetail[] = [
  {
    label: 'Company',
    title: 'Set up your company',
    description: 'Tell us about your organization to personalize your workspace.',
    icon: Building2,
  },
  {
    label: 'You',
    title: 'About you',
    description: "This is how you'll appear to your team in the workspace.",
    icon: UserRound,
  },
  {
    label: 'Plan',
    title: 'Choose your plan',
    description: '14 days free on any plan. No card required.',
    icon: WalletCards,
  },
  {
    label: 'Review',
    title: 'Review and start your trial',
    description:
      "Confirm your workspace details. We'll create everything when you start your trial.",
    icon: ClipboardList,
  },
];
