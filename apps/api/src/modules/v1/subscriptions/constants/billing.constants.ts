export const BILLING_AMOUNT_TOLERANCE = 1;

export const BILLING_WEBHOOK_PROVIDER = 'nomba' as const;

export const BillingChargeType = {
  SUBSCRIPTION: 'subscription',
  SUBSCRIPTION_RENEWAL: 'subscription_renewal',
  SUBSCRIPTION_QUANTITY_UPDATE: 'subscription_quantity_update',
  CARD_UPDATE: 'card_update',
} as const;

export type BillingChargeType = (typeof BillingChargeType)[keyof typeof BillingChargeType];

export const RENEWAL_GRACE_PERIOD_DAYS = 7;

export const DUNNING_RETRY_INTERVALS_DAYS = [0, 2, 4, 6];

/** Nomba requires non-zero checkout amount for card tokenization */
export const CARD_UPDATE_VERIFY_AMOUNT = 100;
