import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Repository } from 'typeorm';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { PENDING_SEAT_CHARGE_TTL_HOURS } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { calculateProratedSeatCharge } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { PlansService } from '../../plans/services/plans.service';

/**
 * Handles seat charge management and quantity synchronization.
 */
@Injectable()
export class SubscriptionSeatChargeService {
  private readonly logger = new Logger(SubscriptionSeatChargeService.name);

  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly plansService: PlansService,
    private readonly tenantSettingsService: TenantSettingsService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async syncSubscriptionQuantity(tenantId: string): Promise<void> {
    if (!isBillingGatewayEnabled()) return;

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId },
      relations: ['planPrice', 'tenant', 'tenant.createdBy'],
    });
    if (
      !subscription ||
      subscription.status !== SubscriptionStatus.ACTIVE ||
      subscription.billingProvider !== BillingProvider.NOMBA ||
      !subscription.nombaSubscriptionId ||
      !subscription.paymentMethodId
    ) {
      return;
    }

    const liveSeats = await this.getTenantSeatCount(tenantId);
    const billedSeats = subscription.currentUsers;

    if (liveSeats === billedSeats) {
      return;
    }

    if (liveSeats < billedSeats) {
      subscription.currentUsers = liveSeats;
      subscription.usageMetrics = {
        ...(subscription.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      await this.subscriptionRepository.save(subscription);
      return;
    }

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice) {
      this.logger.warn(`Plan price ${subscription.planPriceId} not found for tenant ${tenantId}`);
      return;
    }

    const extraSeats = liveSeats - billedSeats;
    const { amount } = calculateProratedSeatCharge(
      planPrice,
      extraSeats,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );

    if (amount <= 0) {
      subscription.currentUsers = liveSeats;
      await this.subscriptionRepository.save(subscription);
      return;
    }

    // Charge logic would go here - for now just update the subscription
    subscription.currentUsers = liveSeats;
    await this.subscriptionRepository.save(subscription);
  }

  async reclaimStuckPendingSeatCharges(): Promise<number> {
    if (!isBillingGatewayEnabled()) {
      return 0;
    }

    const stuck = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .where('sub.status = :active', { active: SubscriptionStatus.ACTIVE })
      .andWhere('sub.billing_provider = :nomba', { nomba: BillingProvider.NOMBA })
      .andWhere(`sub.usage_metrics ? 'pendingSeatCount'`)
      .getMany();

    let reclaimed = 0;
    for (const subscription of stuck) {
      if (!this.isPendingSeatChargeStale(subscription)) {
        continue;
      }
      await this.syncSubscriptionQuantity(subscription.tenantId);
      reclaimed += 1;
    }
    return reclaimed;
  }

  private isPendingSeatChargeStale(subscription: TenantSubscription, now = new Date()): boolean {
    if (subscription.usageMetrics?.pendingSeatCount == null) {
      return false;
    }
    const chargedAtRaw = subscription.usageMetrics.pendingSeatChargedAt;
    if (!chargedAtRaw) {
      return true;
    }
    const chargedAt = new Date(chargedAtRaw);
    if (Number.isNaN(chargedAt.getTime())) {
      return true;
    }
    const ageMs = now.getTime() - chargedAt.getTime();
    return ageMs >= PENDING_SEAT_CHARGE_TTL_HOURS * 60 * 60 * 1000;
  }

  async getTenantSeatCount(tenantId: string): Promise<number> {
    const count = await this.tenantRepository
      .createQueryBuilder('tenant')
      .leftJoin('tenant.members', 'member')
      .where('tenant.id = :tenantId', { tenantId })
      .andWhere('member.isActive = :active', { active: true })
      .getCount();
    
    return Math.max(1, count);
  }
}
