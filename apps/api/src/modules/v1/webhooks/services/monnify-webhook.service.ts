import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractMonnifyPayrollTransfer,
  extractMonnifySubscriptionPayment,
  extractMonnifyWalletTopupCheckout,
} from '../webhook-request.util';

@Injectable()
export class MonnifyWebhookService {
  constructor(
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollPayoutService: PayrollPayoutService,
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

    const payrollTransfer = extractMonnifyPayrollTransfer(payload);
    if (payrollTransfer) {
      await this.payrollPayoutService.processMonnifyPayload(payrollTransfer);
      return { received: true };
    }

    const subscriptionPayment = extractMonnifySubscriptionPayment(payload);
    if (subscriptionPayment) {
      return this.subscriptionBillingService.processMonnifyPayload(payload);
    }

    return { received: true };
  }
}
