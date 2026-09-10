import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  CheckoutInput,
  CheckoutProvider,
  CheckoutResult,
  CheckoutVerificationInput,
  CheckoutVerificationResult,
} from '../../interfaces/checkout-provider.interface';
import { NoahApiService } from '../../services/noah-api.service';

@Injectable()
export class NoahCheckoutAdapter implements CheckoutProvider {
  readonly provider = PaymentProvider.NOAH;

  constructor(private readonly noahApi: NoahApiService) {}

  isConfigured(): boolean {
    return this.noahApi.isConfigured();
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await this.noahApi.createPayinCheckout({
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
    const result = await this.noahApi.verifyTransaction(input.orderReference);
    if (!result) return null;
    return {
      status: result.status,
      amount: result.amount,
      metaData: result.meta,
    };
  }
}
