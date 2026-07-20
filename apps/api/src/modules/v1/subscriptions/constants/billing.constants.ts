export const BILLING_AMOUNT_TOLERANCE = 1;

export enum BillingChargeType {
  SUBSCRIPTION = 'subscription',
  SUBSCRIPTION_RENEWAL = 'subscription_renewal',
  SUBSCRIPTION_QUANTITY_UPDATE = 'subscription_quantity_update',
  CARD_UPDATE = 'card_update',
}

export const RENEWAL_GRACE_PERIOD_DAYS = 7;

export const DUNNING_RETRY_INTERVALS_DAYS = [0, 2, 4, 6];

export const CARD_UPDATE_VERIFY_AMOUNT = 100;

export const SUBSCRIPTION_TRIAL_DAYS = 14;

/** Minimum Nomba charge for a non-zero prorated seat addition */
export const MIN_SEAT_PRORATION_CHARGE = CARD_UPDATE_VERIFY_AMOUNT;

const BILLING_CHARGE_TYPES = new Set<string>(Object.values(BillingChargeType));

export function parseBillingChargeType(value: unknown): BillingChargeType | undefined {
  const normalized = String(value ?? '').trim();
  return BILLING_CHARGE_TYPES.has(normalized) ? (normalized as BillingChargeType) : undefined;
}
