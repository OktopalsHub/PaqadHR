import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyNombaWebhookSignature } from 'src/common/config/nomba-webhook.util';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { RewardsService } from '../../rewards/services/rewards.service';
import {
  extractNombaEventType,
  extractPayrollMerchantRef,
  isSubscriptionPaymentEvent,
  isWalletFundingEvent,
} from '../webhook-request.util';

@Injectable()
export class NombaWebhookService {
  private readonly logger = new Logger(NombaWebhookService.name);

  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly rewardsService: RewardsService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!verifyNombaWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType = extractNombaEventType(payload);

    if (isSubscriptionPaymentEvent(eventType)) {
      return this.subscriptionBillingService.processNombaPayload(payload);
    }

    if (extractPayrollMerchantRef(payload)) {
      return this.payrollPayoutService.processNombaPayload(payload);
    }

    if (isWalletFundingEvent(eventType)) {
      return this.rewardsService.processNombaFundingPayload(payload);
    }

    this.logger.debug(`Ignoring unhandled Nomba webhook event: ${eventType || 'unknown'}`);
    return { received: true };
  }
}
