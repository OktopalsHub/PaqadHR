import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';

@Injectable()
export class PolarWebhookService {
  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing Polar webhook signature');
    }

    if (!this.subscriptionBillingService.verifyPolarWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Polar webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    return this.subscriptionBillingService.processPolarPayload(payload);
  }
}
