import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { normalizeNoahWebhookPayload } from 'src/common/config/noah-api.util';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { BillingProvider } from '../../subscriptions/constants/billing-provider.enum';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractNoahPayrollExternalId,
  extractWalletTopupCheckout,
  isSubscriptionPaymentEvent,
} from '../webhook-request.util';

@Injectable()
export class NoahWebhookService {
  private readonly logger = new Logger(NoahWebhookService.name);

  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly walletTopupService: TenantWalletTopupService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!this.subscriptionBillingService.verifyNoahWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = normalizeNoahWebhookPayload(JSON.parse(rawBody));
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType = this.extractNoahEventType(payload);

    if (extractNoahPayrollExternalId(payload) || this.isNoahTransactionEvent(eventType)) {
      const payrollResult = await this.payrollPayoutService.processNoahPayload(payload);
      if (payrollResult.matched) {
        return { received: true };
      }
    }

    if (isSubscriptionPaymentEvent(eventType) || this.isNoahCheckoutSuccess(eventType)) {
      const walletTopup = extractWalletTopupCheckout(payload);
      if (walletTopup) {
        return this.walletTopupService.completeCheckoutTopup(walletTopup, BillingProvider.NOAH);
      }
      return this.subscriptionBillingService.processNoahPayload(payload);
    }

    this.logger.debug(`Ignoring unhandled Noah webhook event: ${eventType || 'unknown'}`);
    return { received: true };
  }

  private extractNoahEventType(payload: unknown): string {
    const body = payload as { event_type?: string; eventType?: string; type?: string };
    return (body.event_type || body.eventType || body.type || '').toLowerCase();
  }

  private isNoahCheckoutSuccess(eventType: string): boolean {
    return (
      eventType.includes('payment') ||
      eventType.includes('checkout') ||
      eventType.includes('transaction')
    );
  }

  private isNoahTransactionEvent(eventType: string): boolean {
    return eventType.includes('transaction') || eventType.includes('payout');
  }
}
