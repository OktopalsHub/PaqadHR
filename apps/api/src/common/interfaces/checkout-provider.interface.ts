import type { PaymentProvider } from '../enums/payment-provider.enum';

export interface CheckoutInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  customerName: string;
  meta: Record<string, unknown>;
}

export interface CheckoutResult {
  checkoutLink: string;
  orderReference: string;
  transactionReference?: string;
}

export interface CheckoutVerificationInput {
  orderReference: string;
  transactionReference?: string;
}

export interface CheckoutVerificationResult {
  status: string;
  amount?: number;
  cardToken?: string;
  customerEmail?: string;
  cardLastFour?: string;
  cardBrand?: string;
  metaData?: Record<string, unknown>;
}

export interface CheckoutProvider {
  readonly provider: PaymentProvider;
  isConfigured(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyCheckout(input: CheckoutVerificationInput): Promise<CheckoutVerificationResult | null>;
}
