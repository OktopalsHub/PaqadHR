import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

@Injectable()
export class SubscriptionBillingListener {
  private readonly logger = new Logger(SubscriptionBillingListener.name);

  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

  @OnEvent('tenant.member.created')
  @OnEvent('tenant.member.changed')
  async handleMemberChange(payload: { tenantId: string }) {
    if (!payload?.tenantId) return;

    try {
      await this.subscriptionBillingService.syncSubscriptionQuantity(payload.tenantId);
    } catch (error) {
      this.logger.error(
        `Failed to sync subscription seats for tenant ${payload.tenantId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
