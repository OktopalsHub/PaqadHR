import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { parseBachsPayoutWebhook } from 'src/common/config/bachs-payout.util';
import { verifyBachsWebhookSignature } from 'src/common/config/bachs-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollFloatTopupService } from '../../payroll/services/payroll-float-topup.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractBachsPayrollFloatTopupCheckout,
  extractBachsWalletTopupCheckout,
} from '../webhook-request.util';

@Injectable()
export class BachsWebhookService {
  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly payrollFloatTopupService: PayrollFloatTopupService,
    private readonly payrollPayoutService: PayrollPayoutService,
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

    // Payroll payout events (payout.paid / payout.failed) first — they carry
    // withdrawal payloads that must not fall through to billing handling.
    if (parseBachsPayoutWebhook(payload)) {
      await this.payrollPayoutService.processBachsPayload(payload);
      return { received: true };
    }

    const payrollFloatTopup = extractBachsPayrollFloatTopupCheckout(payload);
    if (payrollFloatTopup) {
      const result = await this.payrollFloatTopupService.completeFloatTopup(payrollFloatTopup);
      return { received: result.received };
    }

    const walletTopup = extractBachsWalletTopupCheckout(payload);
    if (walletTopup) {
      return this.walletTopupService.completeCheckoutTopup(walletTopup, PaymentProvider.BACHS);
    }

    return this.subscriptionBillingService.processBachsPayload(payload);
  }
}
