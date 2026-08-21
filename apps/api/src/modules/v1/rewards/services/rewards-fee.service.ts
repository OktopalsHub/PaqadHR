import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';

@Injectable()
export class RewardsFeeService {
  private readonly logger = new Logger(RewardsFeeService.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async getSubscriptionFees(
    tenantId: string,
    _walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    try {
      const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
      const feePercentage = subscription?.planPrice?.regionalConfig?.rewardsFeePercentage ?? 2;
      return { feePercentage, flatFee: 0 };
    } catch {
      return { feePercentage: 2, flatFee: 0 };
    }
  }

  async getRedemptionFees(tenantId: string, currency: string) {
    return this.getSubscriptionFees(tenantId, currency);
  }
}
