import { Injectable } from '@nestjs/common';
import { BachsWalletTopupCurrency, isBachsWalletTopupConfigured } from '../../config/bachs.config';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  CheckoutInput,
  CheckoutProvider,
  CheckoutResult,
  CheckoutVerificationInput,
  CheckoutVerificationResult,
} from '../../interfaces/checkout-provider.interface';
import { BachsApiService } from '../../services/bachs-api.service';

@Injectable()
export class BachsCheckoutAdapter implements CheckoutProvider {
  readonly provider = PaymentProvider.BACHS;

  constructor(private readonly bachsApi: BachsApiService) {}

  isConfigured(): boolean {
    // Available when Bachs is up and at least one wallet currency product is set.
    return (
      this.bachsApi.isConfigured() &&
      (isBachsWalletTopupConfigured('NGN') || isBachsWalletTopupConfigured('USD'))
    );
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const currency = input.currency as BachsWalletTopupCurrency;
    if (!isBachsWalletTopupConfigured(currency)) {
      throw new Error(`Bachs wallet top-up is not configured for ${currency}`);
    }
    const session = await this.bachsApi.createWalletTopupCheckout({
      amount: input.amount,
      currency,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      successUrl: input.callbackUrl,
      reference: input.orderReference,
      metadata: input.meta as Record<string, string | number | boolean | undefined>,
    });
    return {
      checkoutLink: session.checkout_url,
      orderReference: session.reference ?? input.orderReference,
    };
  }

  async verifyCheckout(
    input: CheckoutVerificationInput,
  ): Promise<CheckoutVerificationResult | null> {
    const result = await this.bachsApi.findPaymentByReference(input.orderReference);
    if (!result) return null;
    return {
      status:
        result.status === 'succeeded' || result.status === 'accepted' ? 'success' : result.status,
      amount: result.amount,
    };
  }
}
