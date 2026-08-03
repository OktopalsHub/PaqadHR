import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { TenantWalletVirtualAccountService } from '../../rewards/services/tenant-wallet-virtual-account.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractMonnifySubscriptionPayment,
  extractMonnifyVirtualAccountDeposit,
  extractMonnifyWalletTopupCheckout,
} from '../webhook-request.util';

@Injectable()
export class MonnifyWebhookService {
  constructor(
    private readonly walletVirtualAccountService: TenantWalletVirtualAccountService,
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly subscriptionBillingService: SubscriptionBillingService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!verifyMonnifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const walletTopup = extractMonnifyWalletTopupCheckout(payload);
    if (walletTopup) {
      return this.walletTopupService.completeCheckoutTopup(walletTopup, PaymentProvider.MONNIFY);
    }

    const subscriptionPayment = extractMonnifySubscriptionPayment(payload);
    if (subscriptionPayment) {
      return this.subscriptionBillingService.processMonnifyPayload(payload);
    }

    const deposit = extractMonnifyVirtualAccountDeposit(payload);
    if (deposit) {
      return this.walletVirtualAccountService.completeVirtualAccountDeposit({
        provider: PaymentProvider.MONNIFY,
        ...deposit,
      });
    }

    return { received: true };
  }
}
