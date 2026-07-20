import type { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import type { BillingChargeType } from '../constants/billing.constants';

export interface SubscriptionBillingMetadata
  extends Record<string, string | number | boolean | undefined> {
  tenantId: string;
  planId?: string;
  planPriceId?: string;
  userId?: string;
  tenantMemberId?: string;
  quantity?: number;
  extraSeats?: number;
  targetSeatCount?: number;
  billingType?: BillingChargeType;
}

export interface SubscriptionCheckoutResponse {
  id: string;
  checkoutUrl: string;
  reference: string;
  authorizationUrl?: string;
}

export interface SubscriptionWebhookPayment {
  eventId: string;
  reference: string;
  tenantId: string;
  planId?: string;
  planPriceId?: string;
  quantity?: number;
  extraSeats?: number;
  targetSeatCount?: number;
  amount: number;
  currency: string;
  tokenKey?: string;
  customerEmail?: string;
  status: string;
  billingType?: BillingChargeType;
  cardBrand?: string;
  cardLastFour?: string;
  externalSubscriptionId?: string;
}

export type SubscriptionWebhookEvent =
  | { kind: 'payment.success'; payment: SubscriptionWebhookPayment }
  | { kind: 'payment.failed'; payment: SubscriptionWebhookPayment }
  | {
      kind: 'subscription.created';
      tenantId: string;
      externalSubscriptionId: string;
      eventId: string;
    }
  | {
      kind: 'subscription.cancelled';
      tenantId: string;
      externalSubscriptionId?: string;
      eventId: string;
    }
  | { kind: 'subscription.updated'; reference: string; quantity?: number; status?: string }
  | { kind: 'ignored'; event: string };

export interface SubscriptionSyncData {
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date;
  tokenKey?: string;
  quantity?: number;
  metadata?: SubscriptionBillingMetadata;
}
