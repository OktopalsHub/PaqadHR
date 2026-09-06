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
    return (
      this.bachsApi.isConfigured() &&
      isBachsWalletTopupConfigured(this.resolveCurrency() as BachsWalletTopupCurrency)
    );
  }

  private resolveCurrency(): string | null {
    return null;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await this.bachsApi.createWalletTopupCheckout({
      amount: input.amount,
      currency: input.currency as 'NGN' | 'USD',
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
