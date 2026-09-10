import { Injectable } from '@nestjs/common';
import { NoahAuthService } from './noah-auth.service';
import { NoahCheckoutService } from './noah-checkout.service';
import { NoahPayoutService } from './noah-payout.service';
import { NoahRequestsService } from './noah-requests.service';

export type { NoahCheckoutInput, NoahTokenizedChargeInput } from './noah-checkout.service';
export type { NoahCryptoPayoutInput, NoahFiatPayoutInput } from './noah-payout.service';

@Injectable()
export class NoahApiService {
  constructor(
    private readonly auth: NoahAuthService,
    private readonly requests: NoahRequestsService,
  ) {}

  isConfigured(): boolean {
    return this.auth.isConfigured();
  }

  createPayinCheckout(input: Parameters<NoahCheckoutService['createPayinCheckout']>[0]) {
    return this.requests.createPayinCheckout(input);
  }

  chargeSavedPaymentMethod(input: Parameters<NoahCheckoutService['chargeSavedPaymentMethod']>[0]) {
    return this.requests.chargeSavedPaymentMethod(input);
  }

  createFiatPayout(input: Parameters<NoahPayoutService['createFiatPayout']>[0]) {
    return this.requests.createFiatPayout(input);
  }

  createCryptoPayout(input: Parameters<NoahPayoutService['createCryptoPayout']>[0]) {
    return this.requests.createCryptoPayout(input);
  }

  verifyTransaction(reference: string) {
    return this.requests.verifyTransaction(reference);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return this.requests.verifyWebhookSignature(rawBody, signature);
  }

  parseTransferWebhook(payload: unknown) {
    return this.requests.parseTransferWebhook(payload);
  }

  isSuccessfulStatus(status?: string): boolean {
    return this.requests.isSuccessfulStatus(status);
  }

  hashBody(rawBody: string): string {
    return this.requests.hashBody(rawBody);
  }
}
