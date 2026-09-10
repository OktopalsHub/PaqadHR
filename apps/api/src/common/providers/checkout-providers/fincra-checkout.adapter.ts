import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import type {
  CheckoutInput,
  CheckoutProvider,
  CheckoutResult,
  CheckoutVerificationInput,
  CheckoutVerificationResult,
} from '../../interfaces/checkout-provider.interface';
import { FincraApiService } from '../../services/fincra-api.service';

@Injectable()
export class FincraCheckoutAdapter implements CheckoutProvider {
  readonly provider = PaymentProvider.FINCRA;

  constructor(private readonly fincraApi: FincraApiService) {}

  isConfigured(): boolean {
    return this.fincraApi.isCheckoutConfigured();
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await this.fincraApi.createPayinCheckout({
      amount: input.amount,
      currency: input.currency,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      reference: input.orderReference,
      redirectUrl: input.callbackUrl,
      metadata: { ...input.meta, orderReference: input.orderReference },
    });
    return {
      checkoutLink: session.checkoutLink,
      orderReference: session.orderReference,
    };
  }

  async verifyCheckout(
    input: CheckoutVerificationInput,
  ): Promise<CheckoutVerificationResult | null> {
    const result = await this.fincraApi.verifyPayinStatus(input.orderReference);
    if (!result) return null;
    return {
      status: result.status,
      amount: result.amount,
      metaData: result.metadata,
    };
  }
}
