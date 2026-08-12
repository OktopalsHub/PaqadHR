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

    const walletTopup = extractBachsWalletTopupCheckout(payload);
    if (walletTopup) {
      return this.walletTopupService.completeCheckoutTopup(walletTopup, PaymentProvider.BACHS);
    }

    return this.subscriptionBillingService.processBachsPayload(payload);
  }
}
