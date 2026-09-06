import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  CheckoutInput,
  CheckoutProvider,
  CheckoutResult,
  CheckoutVerificationInput,
  CheckoutVerificationResult,
} from '../../interfaces/checkout-provider.interface';
import { MonnifyApiService } from '../../services/monnify-api.service';

@Injectable()
export class MonnifyCheckoutAdapter implements CheckoutProvider {
  readonly provider = PaymentProvider.MONNIFY;

  constructor(private readonly monnifyApi: MonnifyApiService) {}

  isConfigured(): boolean {
    return this.monnifyApi.isConfigured();
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const init = await this.monnifyApi.initializeTransaction({
      amount: input.amount,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      paymentReference: input.orderReference,
      paymentDescription: 'Rewards wallet top-up',
      redirectUrl: input.callbackUrl,
      currencyCode: 'NGN',
      metaData: input.meta,
    });
    return {
      checkoutLink: init.checkoutUrl,
      orderReference: init.paymentReference,
      transactionReference: init.transactionReference,
    };
  }

  async verifyCheckout(
    input: CheckoutVerificationInput,
  ): Promise<CheckoutVerificationResult | null> {
    const result = await this.monnifyApi.verifyTransaction(
      input.orderReference,
      input.transactionReference,
    );
    if (!result) return null;
    return {
      status: result.paid ? 'success' : 'pending',
      amount: result.amount,
      cardToken: result.cardToken,
      customerEmail: result.customerEmail,
      cardLastFour: result.cardLastFour,
      cardBrand: result.cardBrand,
      metaData: result.metaData,
    };
  }
}
