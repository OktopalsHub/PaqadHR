import { SubscriptionPlan } from '@/lib/constants/feature-access';

export const FEATURE_TIER_MAP: Record<string, SubscriptionPlan> = {
  BASIC_HR: SubscriptionPlan.STARTER,
  PAYROLL: SubscriptionPlan.STARTER,
  ATTENDANCE: SubscriptionPlan.STARTER,
  LEAVE_MANAGEMENT: SubscriptionPlan.STARTER,
  MULTI_CURRENCY: SubscriptionPlan.STARTER,
  ADVANCED_ATTENDANCE: SubscriptionPlan.SCALE,
  PERFORMANCE_MANAGEMENT: SubscriptionPlan.SCALE,
  RECRUITMENT: SubscriptionPlan.STARTER,
  EMPLOYEE_SELF_SERVICE: SubscriptionPlan.STARTER,
  ADVANCED_REPORTING: SubscriptionPlan.GROWTH,
  API_ACCESS: SubscriptionPlan.SCALE,
  INTEGRATIONS: SubscriptionPlan.GROWTH,
  MULTI_LOCATION: SubscriptionPlan.SCALE,
  ADVANCED_PAYROLL: SubscriptionPlan.SCALE,
  LEARNING_DEVELOPMENT: SubscriptionPlan.SCALE,
  CUSTOM_WORKFLOWS: SubscriptionPlan.SCALE,
  WHITE_LABEL: SubscriptionPlan.SCALE,
  COMPLIANCE_REPORTING: SubscriptionPlan.SCALE,
};

export function getFeatureTier(feature: string): SubscriptionPlan | null {
  return FEATURE_TIER_MAP[feature] ?? null;
}

export function getPlansForFeature(
  feature: string,
  currentPlan: SubscriptionPlan,
): SubscriptionPlan[] {
  const tier = FEATURE_TIER_MAP[feature];
  if (!tier) return [];

  const tierOrder = [SubscriptionPlan.STARTER, SubscriptionPlan.GROWTH, SubscriptionPlan.SCALE];
  const currentIndex = tierOrder.indexOf(currentPlan);
  const requiredIndex = tierOrder.indexOf(tier);

  if (requiredIndex <= currentIndex) return [];

  return tierOrder.slice(requiredIndex);
}
