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

  updateSubscription(
    subscriptionReference: string,
    planPrice: PlanPrice,
    quantity: number,
    tokenKey: string,
    customerEmail: string,
    metadata?: SubscriptionBillingMetadata,
  ): Promise<unknown>;

  getSubscription(subscriptionReference: string): Promise<unknown>;

  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  parseWebhook(payload: unknown): SubscriptionWebhookEvent | null;

  mapStatus(status: string): SubscriptionStatus;
}
