import type { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import type {
  SubscriptionBillingMetadata,
  SubscriptionCheckoutResponse,
  SubscriptionWebhookEvent,
} from '../interfaces/subscription-billing.interface';

export interface ISubscriptionBillingProvider {
  createCheckout(
    email: string,
    metadata: SubscriptionBillingMetadata,
    planPrice: PlanPrice,
    successUrl: string,
    quantity?: number,
  ): Promise<SubscriptionCheckoutResponse>;

  getOrCreateCustomer(email: string, displayName?: string): Promise<string>;

  chargeRenewal(
    subscriptionReference: string,
    planPrice: PlanPrice,
    quantity: number,
    tokenKey: string,
    customerEmail: string,
    metadata: SubscriptionBillingMetadata,
  ): Promise<{ orderReference: string }>;

  chargeSeatAddition(
    subscriptionReference: string,
    planPrice: PlanPrice,
    amount: number,
    targetSeatCount: number,
    extraSeats: number,
    tokenKey: string,
    customerEmail: string,
    metadata?: SubscriptionBillingMetadata,
  ): Promise<{ orderReference: string }>;

  getSubscription(subscriptionReference: string): Promise<unknown>;

  createCardUpdateCheckout?(
    email: string,
    metadata: SubscriptionBillingMetadata,
    successUrl: string,
    currency: string,
  ): Promise<SubscriptionCheckoutResponse>;

  verifyWebhookSignature(rawBody: string, signature: string, timestamp?: string): boolean;

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null;

  mapStatus(status: string): SubscriptionStatus;

  ensureConfigured?(): void;

  cancelExternalSubscription?(
    externalSubscriptionId: string,
    options?: { atPeriodEnd?: boolean },
  ): Promise<void>;
}
