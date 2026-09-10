import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { isFincraCheckoutConfigured, isFincraConfigured } from '../config/fincra.config';
import {
  parseFincraPayinWebhook,
  parseFincraPayoutWebhook,
  verifyFincraWebhookSignature,
} from '../config/fincra-webhook.util';
import { FincraAuthService } from './fincra-auth.service';
import { FincraPayoutService } from './fincra-payout.service';

export interface FincraCreatePayinCheckoutInput {
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  reference: string;
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class FincraRequestsService {
  constructor(
    private readonly auth: FincraAuthService,
    private readonly payout: FincraPayoutService,
  ) {}

  isConfigured(): boolean {
    return isFincraConfigured();
  }

  isCheckoutConfigured(): boolean {
    return isFincraCheckoutConfigured();
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return verifyFincraWebhookSignature(rawBody, signature);
  }

  parsePayoutWebhook(payload: unknown) {
    return parseFincraPayoutWebhook(payload);
  }

  parsePayinWebhook(payload: unknown) {
    return parseFincraPayinWebhook(payload);
  }

  generateQuote(input: Parameters<FincraPayoutService['generateQuote']>[0]) {
    return this.payout.generateQuote(input);
  }

  initiatePayout(input: Parameters<FincraPayoutService['initiatePayout']>[0]) {
    return this.payout.initiatePayout(input);
  }

  getPayoutStatus(customerReference: string) {
    return this.payout.getPayoutStatus(customerReference);
  }

  lookupBankAccount(input: { accountNumber: string; bankCode: string }) {
    return this.payout.lookupBankAccount(input);
  }

  isOperationSuccessful(status?: string | null): boolean {
    return this.payout.isOperationSuccessful(status);
  }

  isOperationPending(status?: string | null): boolean {
    return this.payout.isOperationPending(status);
  }

  async createPayinCheckout(input: FincraCreatePayinCheckoutInput): Promise<{
    checkoutLink: string;
    orderReference: string;
  }> {
    const currency = input.currency.toUpperCase();
    const { parsed: response, httpStatus } = await this.auth.request<{
      link?: string;
      reference?: string;
    }>(
      'POST',
      '/checkout/payments',
      {
        currency,
        amount: input.amount,
        customer: { name: input.customerName, email: input.customerEmail },
        reference: input.reference,
        redirectUrl: input.redirectUrl,
        settlementDestination: 'wallet',
        feeBearer: 'business',
        metadata: input.metadata ?? {},
      },
      { usePublicKey: true },
    );

    this.auth.throwIfFincraUnauthorized(httpStatus, response.message);

    const link = response.data?.link;
    if (link) return { checkoutLink: link, orderReference: input.reference };

    const detail = (response.message || 'Fincra checkout failed').trim();
    if (httpStatus >= 400 && httpStatus < 500) throw new BadRequestException(detail);
    throw new BadGatewayException(detail);
  }

  async verifyPayinStatus(merchantReference: string): Promise<{
    status: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  } | null> {
    const encoded = encodeURIComponent(merchantReference);
    const { parsed: response } = await this.auth.request<{
      status?: string;
      amount?: number;
      metadata?: Record<string, unknown>;
    }>('GET', `/checkout/payments/merchant-reference/${encoded}`, undefined, {
      includeBusinessId: true,
    });

    const data = response.data;
    if (!data) return null;

    const status = (data.status ?? '').toLowerCase();
    return {
      status: this.payout.isOperationSuccessful(status) ? 'success' : status,
      amount: data.amount,
      metadata: data.metadata,
    };
  }
}
