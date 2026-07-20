import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyBachsWebhookSignature } from 'src/common/config/bachs-webhook.util';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';

@Injectable()
export class BachsWebhookService {
  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

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

    return this.subscriptionBillingService.processBachsPayload(payload);
  }
}
