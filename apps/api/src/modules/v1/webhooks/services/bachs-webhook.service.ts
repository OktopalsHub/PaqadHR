import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyBachsWebhookSignature } from 'src/common/config/bachs-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';

import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { extractBachsWalletTopupCheckout } from '../webhook-request.util';

@Injectable()
export class BachsWebhookService {
  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly walletTopupService: TenantWalletTopupService,
  ) {}

  async dispatch(
    rawBody: string,
    signature: string,
    timestamp: string,
  ): Promise<{ received: boolean }> {
    if (!signature?.trim() || !timestamp?.trim()) {
      throw new UnauthorizedException('Missing Bachs webhook signature headers');
    }

    if (!verifyBachsWebhookSignature(rawBody, signature, timestamp)) {
      throw new UnauthorizedException('Invalid Bachs webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const savedCard = extractBachsPaymentMethodSaved(payload);
    if (savedCard) {
      await this.walletTopupService.persistBachsSavedPaymentMethod(savedCard);
      return { received: true };
    }

    const walletTopup = extractBachsWalletTopupCheckout(payload);
    if (walletTopup) {
      return this.walletTopupService.completeCheckoutTopup(walletTopup, PaymentProvider.BACHS);
    }

    return this.subscriptionBillingService.processBachsPayload(payload);
  }
}

function extractBachsPaymentMethodSaved(payload: unknown): {
  customerId: string;
  paymentMethodId: string;
  tenantId?: string;
  cardBrand?: string;
  cardLastFour?: string;
} | null {
  const body = payload as {
    type?: string;
    data?: {
      payment_method_id?: string;
      card_brand?: string;
      card_last4?: string;
      customer?: { customer_id?: string; metadata?: Record<string, string> };
      metadata?: Record<string, string>;
    };
  };
  if (String(body.type ?? '').toLowerCase() !== 'payment_method.saved') return null;
  const data = body.data ?? {};
  const customerId = String(data.customer?.customer_id ?? '').trim();
  const paymentMethodId = String(data.payment_method_id ?? '').trim();
  if (!customerId || !paymentMethodId) return null;
  const tenantId = String(
    data.metadata?.tenantId ?? data.customer?.metadata?.tenantId ?? '',
  ).trim();
  const cardBrand = String(data.card_brand ?? '').trim();
  const cardLastFour = String(data.card_last4 ?? '').trim();
  return {
    customerId,
    paymentMethodId,
    ...(tenantId ? { tenantId } : {}),
    ...(cardBrand ? { cardBrand } : {}),
    ...(cardLastFour ? { cardLastFour } : {}),
  };
}
