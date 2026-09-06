import { Inject, Injectable, Optional } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  CheckoutInput,
  CheckoutProvider,
  CheckoutResult,
  CheckoutVerificationInput,
  CheckoutVerificationResult,
} from '../../interfaces/checkout-provider.interface';

export const NOMBA_CHECKOUT_API = 'NOMBA_CHECKOUT_API';

export interface NombaCheckoutApi {
  isConfigured(): boolean;
  createCheckoutOrder(input: {
    orderReference: string;
    customerEmail: string;
    amount: number;
    currency: string;
    callbackUrl: string;
    tokenizeCard?: boolean;
    meta?: Record<string, string | number | boolean | undefined>;
  }): Promise<{ checkoutLink: string; orderReference: string }>;
  verifyTransaction(
    reference: string,
  ): Promise<
    { status?: string; amount?: number; meta?: Record<string, unknown> } | null | undefined
  >;
}

@Injectable()
export class NombaCheckoutAdapter implements CheckoutProvider {
  readonly provider = PaymentProvider.NOMBA;

  constructor(
    @Optional()
    @Inject(NOMBA_CHECKOUT_API)
    private readonly nombaApi?: NombaCheckoutApi,
  ) {}

  isConfigured(): boolean {
    return this.nombaApi?.isConfigured() ?? false;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.nombaApi) throw new Error('Nomba checkout API not configured');
    const session = await this.nombaApi.createCheckoutOrder({
      orderReference: input.orderReference,
      customerEmail: input.customerEmail,
      amount: input.amount,
      currency: input.currency,
      callbackUrl: input.callbackUrl,
      tokenizeCard: false,
      meta: input.meta as Record<string, string | number | boolean | undefined>,
    });
    return {
      checkoutLink: session.checkoutLink,
      orderReference: session.orderReference,
    };
  }

  async verifyCheckout(
    input: CheckoutVerificationInput,
  ): Promise<CheckoutVerificationResult | null> {
    if (!this.nombaApi) return null;
    const result = await this.nombaApi.verifyTransaction(input.orderReference);
    if (!result || result === undefined) return null;
    return {
      status: result.status ?? 'unknown',
      amount: result.amount,
      metaData: result.meta,
    };
  }
}
