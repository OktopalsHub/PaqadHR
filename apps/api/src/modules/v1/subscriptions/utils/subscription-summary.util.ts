import type { TenantSubscription } from '../entities/tenant-subscription.entity';

export function toSubscriptionSummary(subscription: TenantSubscription | null) {
  if (!subscription) return null;
  const { plan, planPrice } = subscription;
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    planId: subscription.planId,
    planPriceId: subscription.planPriceId,
    status: subscription.status,
    currentUsers: subscription.currentUsers,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    nextBillingDate: subscription.nextBillingDate,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    cancelledAt: subscription.cancelledAt,
    paymentMethodBrand: subscription.paymentMethodBrand,
    paymentMethodLastFour: subscription.paymentMethodLastFour,
    plan: plan
      ? {
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          features: plan.features,
          limits: plan.limits,
        }
      : null,
    planPrice: planPrice
      ? {
          id: planPrice.id,
          currency: planPrice.currency,
          monthlyPrice: planPrice.monthlyPrice,
          yearlyPrice: planPrice.yearlyPrice,
        }
      : null,
  };
}
