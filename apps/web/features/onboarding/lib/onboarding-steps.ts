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
    description: 'Company details.',
    icon: Building2,
  },
  {
    label: 'You',
    title: 'About you',
    description: 'Your profile.',
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
    description: 'Confirm details, then start trial.',
    icon: ClipboardList,
  },
];
