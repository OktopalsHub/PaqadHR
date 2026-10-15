import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { SUBSCRIPTION_TRIAL_DAYS } from '../constants/billing.constants';
import type { ActivateSubscriptionDto } from '../dto/activate-subscription.dto';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { SubscriptionEntitlementService } from './subscription-entitlement.service';
import { SubscriptionRegionService } from './subscription-region.service';

@Injectable()
export class SubscriptionLifecycleService {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly plansService: PlansService,
    private readonly auditLogsService: AuditLogsService,
    private readonly entitlementService: SubscriptionEntitlementService,
    private readonly regionService: SubscriptionRegionService,
  ) {}

  private async saveAndReload(subscription: TenantSubscription): Promise<TenantSubscription> {
    const saved = await this.subscriptionRepository.save(subscription);
    const loaded = await this.subscriptionRepository.findOne({
      where: { id: saved.id },
      relations: ['plan', 'planPrice', 'planPrice.plan'],
    });
    return loaded ?? saved;
  }

  async activateTenantSubscription(
    tenantId: string,
    options: ActivateSubscriptionDto = {},
  ): Promise<TenantSubscription> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    let subscription = await this.entitlementService.getTenantSubscription(tenantId);
    if (!subscription) {
      subscription = await this.createTrialSubscription(tenantId, {
        planSlug: options.planSlug,
        trialDays: 0,
      });
    }

    if (options.planSlug) {
      const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
        tenant.countryCode,
        tenant.preferredCurrency,
      );
      const planPrice = await this.plansService.getPlanPrice(
        options.planSlug,
        countryCode,
        currency,
      );
      if (!planPrice) {
        throw new BadRequestException(
          `Plan "${options.planSlug}" not found for region ${countryCode}`,
        );
      }
      subscription.planId = planPrice.planId;
      subscription.planPriceId = planPrice.id;
    }

    const periodMonths = options.periodMonths ?? 1;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.nextBillingDate = periodEnd;
    subscription.trialEndsAt = null;

    return this.saveAndReload(subscription);
  }

  async extendTrial(tenantId: string, additionalDays: number): Promise<TenantSubscription> {
    const subscription = await this.entitlementService.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const base =
      subscription.trialEndsAt && subscription.trialEndsAt > new Date()
        ? subscription.trialEndsAt
        : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + additionalDays);

    subscription.status = SubscriptionStatus.TRIAL;
    subscription.trialEndsAt = newEnd;
    subscription.currentPeriodEnd = newEnd;
    subscription.nextBillingDate = newEnd;

    const result = await this.saveAndReload(subscription);

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.SUBSCRIPTION_CREATED,
        description: `Trial extended by ${additionalDays} days`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant_subscription',
        resourceId: result.id,
        tenantId,
        metadata: { additionalDays, newTrialEnd: newEnd.toISOString() },
      })
      .catch(() => {});

    return result;
  }

  async createTrialSubscription(
    tenantId: string,
    options?: {
      trialDays?: number;
      planSlug?: string;
      clientIp?: string | null;
      headers?: Record<string, string | string[] | undefined>;
      userId?: string | null;
    },
  ): Promise<TenantSubscription> {
    const existing = await this.entitlementService.getTenantSubscription(tenantId);
    if (existing) {
      return existing;
    }

    const tenant = await this.regionService.resolveAndLockTenantRegion(tenantId, {
      clientIp: options?.clientIp,
      headers: options?.headers,
      userId: options?.userId,
    });

    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      tenant.countryCode,
      tenant.preferredCurrency,
    );

    const planSlug = options?.planSlug ?? 'starter';
    const planPrice = await this.plansService.getPlanPrice(planSlug, countryCode, currency);

    if (!planPrice) {
      throw new BadRequestException(
        `Plan "${planSlug}" not found for region ${countryCode}. Ensure plans are seeded.`,
      );
    }

    const trialDays = options?.trialDays ?? SUBSCRIPTION_TRIAL_DAYS;
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const subscription = this.subscriptionRepository.create({
      tenantId,
      planId: planPrice.planId,
      planPriceId: planPrice.id,
      status: SubscriptionStatus.TRIAL,
      currentUsers: 0,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      nextBillingDate: trialEndsAt,
      usageMetrics: {},
    });

    return this.saveAndReload(subscription);
  }

  async setTrialPlan(
    tenantId: string,
    planSlug: string,
    options: {
      clientIp?: string | null;
      headers?: Record<string, string | string[] | undefined>;
      userId?: string | null;
    } = {},
  ): Promise<TenantSubscription> {
    const subscription = await this.entitlementService.getTenantSubscription(tenantId);
    if (!subscription || subscription.status !== SubscriptionStatus.TRIAL) {
      throw new BadRequestException('Trial is not active');
    }

    const tenant = await this.regionService.resolveAndLockTenantRegion(tenantId, {
      clientIp: options.clientIp,
      headers: options.headers,
      userId: options.userId,
    });

    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      tenant.countryCode,
      tenant.preferredCurrency,
    );

    const normalizedSlug = planSlug.trim().toLowerCase();
    const planPrice = await this.plansService.getPlanPrice(normalizedSlug, countryCode, currency);
    if (!planPrice) {
      throw new BadRequestException(`Plan "${normalizedSlug}" is not available in your region`);
    }

    subscription.planId = planPrice.planId;
    subscription.planPriceId = planPrice.id;
    return this.saveAndReload(subscription);
  }

  async hasUserEverUsedTrial(userId: string): Promise<boolean> {
    const count = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .innerJoin(TenantMember, 'tm', 'tm.tenantId = sub.tenantId')
      .where('tm.userId = :userId', { userId })
      .andWhere('tm.role = :role', { role: TenantMemberRole.OWNER })
      .andWhere('(sub.status = :trial OR sub.trialEndsAt IS NOT NULL)', {
        trial: SubscriptionStatus.TRIAL,
      })
      .getCount();
    return count > 0;
  }

  async isTrialEligible(userId: string | null | undefined, tenantId: string): Promise<boolean> {
    const existing = await this.entitlementService.getTenantSubscription(tenantId);
    if (existing?.status === SubscriptionStatus.TRIAL) {
      return true;
    }
    if (!userId) {
      return true;
    }
    return !(await this.hasUserEverUsedTrial(userId));
  }

  async startTrial(
    tenantId: string,
    planSlug: string,
    options: {
      clientIp?: string | null;
      headers?: Record<string, string | string[] | undefined>;
      userId?: string | null;
    } = {},
  ): Promise<TenantSubscription> {
    const existing = await this.entitlementService.getTenantSubscription(tenantId);
    if (existing?.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Workspace already has an active subscription');
    }
    if (existing?.status === SubscriptionStatus.TRIAL) {
      return this.setTrialPlan(tenantId, planSlug, options);
    }
    if (options.userId && (await this.hasUserEverUsedTrial(options.userId))) {
      throw new BadRequestException(
        'You have already used your free trial on another workspace. Subscribe to continue.',
      );
    }
    if (existing) {
      await this.subscriptionRepository.remove(existing);
    }
    return this.createTrialSubscription(tenantId, {
      planSlug,
      trialDays: SUBSCRIPTION_TRIAL_DAYS,
      ...options,
    });
  }
}
