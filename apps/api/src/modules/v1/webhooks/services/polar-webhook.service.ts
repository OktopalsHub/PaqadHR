import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  extractPolarWebhookHeaders,
  verifyPolarWebhookSignature,
} from 'src/common/config/polar-webhook.util';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';

@Injectable()
export class PolarWebhookService {
  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

  async dispatch(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean }> {
    const polarHeaders = extractPolarWebhookHeaders(headers);
    if (!polarHeaders) {
      throw new UnauthorizedException('Missing Polar webhook signature headers');
    }

    if (!verifyPolarWebhookSignature(rawBody, polarHeaders)) {
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
