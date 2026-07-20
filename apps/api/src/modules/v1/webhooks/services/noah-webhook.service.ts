import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { normalizeNoahWebhookPayload } from 'src/common/config/noah-api.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import {
  extractNoahPayrollExternalId,
  extractWalletTopupCheckout,
  isSubscriptionPaymentEvent,
} from '../webhook-request.util';

@Injectable()
export class NoahWebhookService {
  private readonly logger = new Logger(NoahWebhookService.name);

  constructor(
    private readonly noahApi: NoahApiService,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly walletTopupService: TenantWalletTopupService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!this.noahApi.verifyWebhookSignature(rawBody, signature)) {
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
        return this.walletTopupService.completeCheckoutTopup(walletTopup, PaymentProvider.NOAH);
      }
      this.logger.debug(
        `Ignoring Noah checkout event (subscriptions use Bachs/Polar/Nomba): ${eventType}`,
      );
    }

    this.logger.debug(`Ignoring unhandled Noah webhook event: ${eventType || 'unknown'}`);
    return { received: true };
  }

  private extractNoahEventType(payload: unknown): string {
    const body = payload as {
      event_type?: string;
      eventType?: string;
      EventType?: string;
      type?: string;
    };
    return (body.event_type || body.eventType || body.EventType || body.type || '').toLowerCase();
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
