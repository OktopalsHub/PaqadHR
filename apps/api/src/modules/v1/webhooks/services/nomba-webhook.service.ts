import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { verifyNombaWebhookSignature } from 'src/common/config/nomba-webhook.util';
import { PayrollFloatTopupService } from '../../payroll/services/payroll-float-topup.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractNombaEventType,
  extractPayrollFloatTopupCheckout,
  extractPayrollMerchantRef,
  extractWalletTopupCheckout,
  isSubscriptionPaymentEvent,
} from '../webhook-request.util';

export { extractWalletTopupCheckout };

@Injectable()
export class NombaWebhookService {
  private readonly logger = new Logger(NombaWebhookService.name);

  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly payrollFloatTopupService: PayrollFloatTopupService,
    private readonly walletTopupService: TenantWalletTopupService,
  ) {}

  async dispatch(
    rawBody: string,
    signature: string,
    timestamp?: string,
  ): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!verifyNombaWebhookSignature(rawBody, signature, timestamp)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType = extractNombaEventType(payload);
    const payrollFloatTopup = extractPayrollFloatTopupCheckout(payload);
    if (payrollFloatTopup) {
      const result = await this.payrollFloatTopupService.completeFloatTopup(payrollFloatTopup);
      return { received: result.received };
    }

    const walletTopup = extractWalletTopupCheckout(payload);
    if (walletTopup) {
      return this.walletTopupService.completeCheckoutTopup(walletTopup);
    }

    if (isSubscriptionPaymentEvent(eventType)) {
      return this.subscriptionBillingService.processNombaPayload(payload);
    }

    // Bank transfers use payout_success / payout_failed (not payment_*).
    if (eventType.includes('payout') || extractPayrollMerchantRef(payload)) {
      return this.payrollPayoutService.processNombaPayload(payload);
    }

    this.logger.debug(`Ignoring unhandled Nomba webhook event: ${eventType || 'unknown'}`);
    return { received: true };
  }
}
