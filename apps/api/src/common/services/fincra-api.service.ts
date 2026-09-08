import { Injectable } from '@nestjs/common';
import { FincraAuthService } from './fincra-auth.service';
import { FincraPayoutService } from './fincra-payout.service';
import { FincraRequestsService } from './fincra-requests.service';

export type {
  FincraInitiatePayoutInput,
  FincraQuoteResult,
} from './fincra-payout.service';
export type { FincraCreatePayinCheckoutInput } from './fincra-requests.service';

@Injectable()
export class FincraApiService {
  constructor(
    private readonly auth: FincraAuthService,
    private readonly requests: FincraRequestsService,
  ) {}

  isConfigured(): boolean {
    return this.requests.isConfigured();
  }

  isCheckoutConfigured(): boolean {
    return this.requests.isCheckoutConfigured();
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return this.requests.verifyWebhookSignature(rawBody, signature);
  }

  parsePayoutWebhook(payload: unknown) {
    return this.requests.parsePayoutWebhook(payload);
  }

  parsePayinWebhook(payload: unknown) {
    return this.requests.parsePayinWebhook(payload);
  }

  generateQuote(input: Parameters<FincraPayoutService['generateQuote']>[0]) {
    return this.requests.generateQuote(input);
  }

  initiatePayout(input: Parameters<FincraPayoutService['initiatePayout']>[0]) {
    return this.requests.initiatePayout(input);
  }

  getPayoutStatus(customerReference: string) {
    return this.requests.getPayoutStatus(customerReference);
  }

  lookupBankAccount(input: { accountNumber: string; bankCode: string }) {
    return this.requests.lookupBankAccount(input);
  }

  createPayinCheckout(input: Parameters<FincraRequestsService['createPayinCheckout']>[0]) {
    return this.requests.createPayinCheckout(input);
  }

  verifyPayinStatus(merchantReference: string) {
    return this.requests.verifyPayinStatus(merchantReference);
  }

  isOperationSuccessful(status?: string | null): boolean {
    return this.requests.isOperationSuccessful(status);
  }

  isOperationPending(status?: string | null): boolean {
    return this.requests.isOperationPending(status);
  }

  resolveBusinessId() {
    return this.auth.resolveBusinessId();
  }

  resolvePayoutSourceCurrency() {
    return this.auth.resolvePayoutSourceCurrency();
  }
}
