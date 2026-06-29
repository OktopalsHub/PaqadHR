export const BILLING_AMOUNT_TOLERANCE = 1;

export const BILLING_WEBHOOK_PROVIDER = 'nomba' as const;

export const BillingChargeType = {
  SUBSCRIPTION: 'subscription',
  SUBSCRIPTION_RENEWAL: 'subscription_renewal',
  SUBSCRIPTION_QUANTITY_UPDATE: 'subscription_quantity_update',
} as const;

export type BillingChargeType = (typeof BillingChargeType)[keyof typeof BillingChargeType];

export const RENEWAL_GRACE_PERIOD_DAYS = 7;
