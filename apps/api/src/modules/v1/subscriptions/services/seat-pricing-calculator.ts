import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { BillingChargeType } from '../constants/billing.constants';
import { BillingProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { calculateProratedSeatCharge, resolveSeatCount } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';

@Injectable()
export class SeatPricingCalculator {
  private readonly logger = new Logger(SeatPricingCalculator.name);

  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
    private readonly plansService: PlansService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly billingProviderFactory: BillingProviderFactoryService,
  ) {}

  async getTenantSeatCount(tenantId: string): Promise<number> {
    const count = await this.tenantMemberRepository.count({
      where: { tenantId, isActive: true },
    });
    return resolveSeatCount(count);
  }

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
    const pendingSeatCount = subscription.usageMetrics?.pendingSeatCount;

    if (pendingSeatCount != null) {
      const pendingStale = this.isPendingSeatChargeStale(subscription);
      const seatsDecreased = liveSeats < billedSeats;
      const pendingTargetDrifted = liveSeats !== pendingSeatCount;

      // Only discard an in-flight charge when stale or seats dropped.
      // Upward drift must wait for settlement or overlapping seats are charged twice.
      if (!pendingStale && !seatsDecreased) {
        if (pendingTargetDrifted) {
          this.logger.warn(
            `Deferring seat sync for tenant ${tenantId}; pending charge for ${pendingSeatCount} seats is still in flight (live=${liveSeats})`,
          );
        }
        return;
      }

      this.logger.warn(
        `Clearing stuck pending seat charge for tenant ${tenantId} (stale=${pendingStale}, decreased=${seatsDecreased}, drifted=${pendingTargetDrifted})`,
      );
      subscription.usageMetrics = {
        ...(subscription.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      if (seatsDecreased) {
        subscription.currentUsers = liveSeats;
        await this.subscriptionRepository.save(subscription);
        return;
      }
      await this.subscriptionRepository.save(subscription);
    }

    if (liveSeats === billedSeats) return;

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

    const billingEmail = await this.resolveBillingEmail(
      tenantId,
      subscription.tenant?.createdBy?.email,
    );
    if (!billingEmail) {
      this.logger.warn(`No billing contact email for tenant ${tenantId}`);
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

    await this.billingProviderFactory
      .getNombaProvider()
      .chargeSeatAddition(
        subscription.nombaSubscriptionId,
        planPrice,
        amount,
        liveSeats,
        extraSeats,
        subscription.paymentMethodId,
        billingEmail,
        {
          tenantId,
          planId: subscription.planId,
          planPriceId: subscription.planPriceId,
          quantity: liveSeats,
          targetSeatCount: liveSeats,
          extraSeats,
          billingType: BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE,
        },
      );

    subscription.usageMetrics = {
      ...(subscription.usageMetrics ?? {}),
      pendingSeatCount: liveSeats,
      pendingExtraSeats: extraSeats,
      pendingChargeAmount: amount,
      pendingSeatChargedAt: new Date().toISOString(),
    };
    await this.subscriptionRepository.save(subscription);
  }

  async reclaimStuckPendingSeatCharges(): Promise<number> {
    if (!isBillingGatewayEnabled()) return 0;

    const stuck = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .where('sub.status = :active', { active: SubscriptionStatus.ACTIVE })
      .andWhere('sub.billing_provider = :nomba', { nomba: BillingProvider.NOMBA })
      .andWhere(`sub.usage_metrics ? 'pendingSeatCount'`)
      .getMany();

    let reclaimed = 0;
    for (const subscription of stuck) {
      if (!this.isPendingSeatChargeStale(subscription)) continue;
      await this.syncSubscriptionQuantity(subscription.tenantId);
      reclaimed += 1;
    }
    return reclaimed;
  }

  isPendingSeatChargeStale(subscription: TenantSubscription, now = new Date()): boolean {
    const chargedAt = subscription.usageMetrics?.pendingSeatChargedAt;
    if (!chargedAt) return false;
    const ageMs = now.getTime() - new Date(chargedAt).getTime();
    const maxAgeMs = 30 * 60 * 1000;
    return ageMs > maxAgeMs;
  }

  private async resolveBillingEmail(
    tenantId: string,
    fallbackEmail?: string | null,
  ): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {}
    return fallbackEmail?.trim() || null;
  }
}
