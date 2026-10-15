export const BILLING_AMOUNT_TOLERANCE = 1;

export enum BillingChargeType {
  SUBSCRIPTION = 'subscription',
  SUBSCRIPTION_RENEWAL = 'subscription_renewal',
  SUBSCRIPTION_QUANTITY_UPDATE = 'subscription_quantity_update',
  CARD_UPDATE = 'card_update',
}

export const RENEWAL_GRACE_PERIOD_DAYS = 7;

/** Absolute day offsets from billingAnchor for retries after failure 1..N (no same-day re-hammer). */
export const DUNNING_RETRY_INTERVALS_DAYS = [2, 4, 6];

/** Drop stuck seat-addition pending flags after this many hours and retry. */
export const PENDING_SEAT_CHARGE_TTL_HOURS = 48;

/** Cron owns an in-flight renewal claim for this long before webhooks may take over. */
export const RENEWAL_PENDING_CLAIM_TTL_MS = 5 * 60 * 1000;

export const CARD_UPDATE_VERIFY_AMOUNT = 100;

export const SUBSCRIPTION_TRIAL_DAYS = 14;

/** Minimum Nomba charge for a non-zero prorated seat addition */
export const MIN_SEAT_PRORATION_CHARGE = CARD_UPDATE_VERIFY_AMOUNT;

const BILLING_CHARGE_TYPES = new Set<string>(Object.values(BillingChargeType));

export function parseBillingChargeType(value: unknown): BillingChargeType | undefined {
  const normalized = String(value ?? '').trim();
  return BILLING_CHARGE_TYPES.has(normalized) ? (normalized as BillingChargeType) : undefined;
}
