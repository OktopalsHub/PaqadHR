import type { PaymentProvider } from 'src/common/enums';
export interface CreateSubscriptionPayload {
  customerEmail: string;
  customerId?: string;
  trialDays?: number;
  amount?: number;
  currency?: string;
  countryCode?: string;
}
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  checkoutUrl?: string;
}
export interface IPaymentProvider {
  getProviderType(): PaymentProvider;
  createSubscription(
    planId: string,
    data: CreateSubscriptionPayload,
  ): Promise<CreateSubscriptionResponse>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<any | null>;
  updateSubscription(subscriptionId: string, updates: unknown): Promise<unknown>;
  processWebhook(payload: unknown, signature: string): Promise<void>;
}
