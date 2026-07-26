import type { PlanSlug } from '@/lib/constants/plan-catalog';
import { PLAN_SLUG_ORDER } from '@/lib/constants/plan-catalog';

type SubscriptionPlan = PlanSlug;

const FEATURE_TIER_MAP: Record<string, SubscriptionPlan> = {
  BASIC_HR: 'starter',
  PAYROLL: 'starter',
  ATTENDANCE: 'starter',
  LEAVE_MANAGEMENT: 'starter',
  RECRUITMENT: 'starter',
  EMPLOYEE_SELF_SERVICE: 'starter',
  ADVANCED_PAYROLL: 'starter',
  INTEGRATIONS: 'growth',
  ADVANCED_REPORTING: 'growth',
  ADVANCED_ATTENDANCE: 'scale',
  PERFORMANCE_MANAGEMENT: 'scale',
  API_ACCESS: 'scale',
  MULTI_LOCATION: 'scale',
  COMPLIANCE_REPORTING: 'scale',
  MULTI_CURRENCY: 'scale',
  LEARNING_DEVELOPMENT: 'scale',
  CUSTOM_WORKFLOWS: 'scale',
  WHITE_LABEL: 'scale',
};

export function getMinimumTierForFeature(feature: string): SubscriptionPlan | null {
  return FEATURE_TIER_MAP[feature] ?? null;
}

export function getPlansForFeature(
  feature: string,
  currentPlan: SubscriptionPlan,
): SubscriptionPlan[] {
  const minimumTier = getMinimumTierForFeature(feature);
  if (!minimumTier) return [];

  const currentIndex = PLAN_SLUG_ORDER.indexOf(currentPlan);
  const minimumIndex = PLAN_SLUG_ORDER.indexOf(minimumTier);

  if (currentIndex >= minimumIndex) return [];

  return PLAN_SLUG_ORDER.filter(
    (_, index) => index >= minimumIndex && PLAN_SLUG_ORDER[index] !== currentPlan,
  );
}
