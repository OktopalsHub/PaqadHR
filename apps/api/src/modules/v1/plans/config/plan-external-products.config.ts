import type { PlanPrice } from '../entities/plan-price.entity';

/** Bachs recurring product ID stored on plan_prices (sync via sync:bachs-products). */
export function resolveBachsProductId(planPrice: PlanPrice): string | null {
  return planPrice.bachsProductId?.trim() || null;
}
