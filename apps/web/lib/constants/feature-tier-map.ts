import { FeatureAccess } from '@/lib/constants/feature-access';
import { PLAN_SLUG_ORDER, type PlanSlug } from '@/lib/constants/plan-catalog';

export const FEATURE_TIER_MAP: Record<FeatureAccess, PlanSlug> = {
  [FeatureAccess.BASIC_HR]: 'starter',
  [FeatureAccess.PAYROLL]: 'starter',
  [FeatureAccess.ATTENDANCE]: 'starter',
  [FeatureAccess.LEAVE_MANAGEMENT]: 'starter',
  [FeatureAccess.MULTI_CURRENCY]: 'starter',
  [FeatureAccess.ADVANCED_ATTENDANCE]: 'scale',
  [FeatureAccess.PERFORMANCE_MANAGEMENT]: 'scale',
  [FeatureAccess.RECRUITMENT]: 'starter',
  [FeatureAccess.EMPLOYEE_SELF_SERVICE]: 'starter',
  [FeatureAccess.ADVANCED_REPORTING]: 'growth',
  [FeatureAccess.API_ACCESS]: 'scale',
  [FeatureAccess.INTEGRATIONS]: 'growth',
  [FeatureAccess.MULTI_LOCATION]: 'scale',
  [FeatureAccess.ADVANCED_PAYROLL]: 'scale',
  [FeatureAccess.LEARNING_DEVELOPMENT]: 'scale',
  [FeatureAccess.CUSTOM_WORKFLOWS]: 'scale',
  [FeatureAccess.WHITE_LABEL]: 'scale',
  [FeatureAccess.COMPLIANCE_REPORTING]: 'scale',
};

export function getFeatureTier(feature: string): PlanSlug | null {
  return FEATURE_TIER_MAP[feature as FeatureAccess] ?? null;
}

export function getPlansForFeature(
  feature: string,
  currentPlan: PlanSlug,
): PlanSlug[] {
  const tier = FEATURE_TIER_MAP[feature as FeatureAccess];
  if (!tier) return [];

  const currentIndex = PLAN_SLUG_ORDER.indexOf(currentPlan);
  const requiredIndex = PLAN_SLUG_ORDER.indexOf(tier);

  if (requiredIndex <= currentIndex) return [];

  return PLAN_SLUG_ORDER.slice(requiredIndex);
}
