import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess, SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { hasPlanFeaturesAccess } from '../../../../common/constants/feature-access-resolver';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { isPayrollGatewayEnabled } from '../../payroll/config/payroll-disbursement.config';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { isBillingGatewayEnabled, isFeatureGatingEnabled } from '../config/billing.config';
import { SUBSCRIPTION_TRIAL_DAYS } from '../constants/billing.constants';
import type { ActivateSubscriptionDto } from '../dto/activate-subscription.dto';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { isWithinRenewalGrace } from '../utils/dunning.util';

export type NeedsPaymentInput = {
  status: SubscriptionStatus;
  daysRemaining?: number | null;
  trialEndsAt?: Date | string | null;
  nextBillingDate?: Date | string | null;
} | null;

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly plansService: PlansService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { tenantId },
      relations: ['tenant', 'plan', 'planPrice', 'planPrice.plan'],
    });
  }

  async updateTenantSubscription(
    tenantId: string,
    updates: Partial<TenantSubscription>,
  ): Promise<TenantSubscription> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    Object.assign(subscription, updates);
    const saved = await this.subscriptionRepository.save(subscription);

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.SUBSCRIPTION_CREATED,
        description: `Subscription updated`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant_subscription',
        resourceId: subscription.id,
        tenantId,
        metadata: { updatedFields: Object.keys(updates) },
      })
      .catch(() => {});

    return saved;
  }

  async hasFeatureAccess(tenantId: string, features: FeatureAccess[]): Promise<boolean> {
    if (!isFeatureGatingEnabled()) {
      return true;
    }

    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription || !this.isSubscriptionEntitled(subscription)) {
      return false;
    }

    const planFeatures = subscription.plan?.features ?? {};
    return hasPlanFeaturesAccess(planFeatures, features);
  }

  isSubscriptionEntitled(subscription: TenantSubscription): boolean {
    const now = new Date();
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      if (subscription.nextBillingDate && now >= subscription.nextBillingDate) {
        return isWithinRenewalGrace(subscription.nextBillingDate, now);
      }
      return true;
    }
    if (subscription.status === SubscriptionStatus.TRIAL) {
      if (!subscription.trialEndsAt) {
        return true;
      }
      return now < subscription.trialEndsAt;
    }
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      return isWithinRenewalGrace(subscription.nextBillingDate, now);
    }
    if (subscription.status === SubscriptionStatus.PAUSED) {
      return now < subscription.currentPeriodEnd;
    }
    return false;
  }

  async getBillingStatus(tenantId: string): Promise<{
    paymentsEnabled: boolean;
    payrollGatewayEnabled: boolean;
    featureGatingEnabled: boolean;
    entitled: boolean;
    needsPayment: boolean;
    subscription: {
      status: SubscriptionStatus;
      plan: string;
      trialEndsAt: Date | null;
      isOnTrial: boolean;
      daysRemaining: number | null;
      currentPeriodEnd: Date;
      nextBillingDate: Date;
    } | null;
  }> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      return {
        paymentsEnabled: isBillingGatewayEnabled(),
        payrollGatewayEnabled: isPayrollGatewayEnabled(),
        featureGatingEnabled: isFeatureGatingEnabled(),
        entitled: false,
        needsPayment: true,
        subscription: null,
      };
    }

    let daysRemaining: number | null = null;
    if (subscription.trialEndsAt) {
      const ms = subscription.trialEndsAt.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    const subscriptionSummary = {
      status: subscription.status,
      plan: subscription.plan?.slug ?? subscription.plan?.name ?? 'starter',
      trialEndsAt: subscription.trialEndsAt,
      isOnTrial: subscription.isOnTrial,
      daysRemaining,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingDate: subscription.nextBillingDate,
    };

    return {
      paymentsEnabled: isBillingGatewayEnabled(),
      payrollGatewayEnabled: isPayrollGatewayEnabled(),
      featureGatingEnabled: isFeatureGatingEnabled(),
      entitled: this.isSubscriptionEntitled(subscription),
      needsPayment: this.computeNeedsPayment(subscriptionSummary),
      subscription: subscriptionSummary,
    };
  }

  computeNeedsPayment(subscription: NeedsPaymentInput): boolean {
    if (!subscription) {
      return true;
    }
    if (
      subscription.status === SubscriptionStatus.EXPIRED ||
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.SUSPENDED ||
      subscription.status === SubscriptionStatus.INACTIVE ||
      subscription.status === SubscriptionStatus.CANCELLED
    ) {
      return true;
    }
    const now = Date.now();
    if (subscription.status === SubscriptionStatus.TRIAL) {
      if (subscription.trialEndsAt) {
        return now >= new Date(subscription.trialEndsAt).getTime();
      }
      return subscription.daysRemaining === 0;
    }
    if (subscription.status === SubscriptionStatus.ACTIVE && subscription.nextBillingDate) {
      return now >= new Date(subscription.nextBillingDate).getTime();
    }
    return false;
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

    let subscription = await this.getTenantSubscription(tenantId);
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

    const history = subscription.billingHistory ?? [];
    history.push({
      date: now,
      amount: 0,
      currency: tenant.preferredCurrency ?? 'USD',
      status: 'paid',
      invoiceId: `manual-${now.getTime()}`,
    });
    subscription.billingHistory = history;

    const saved = await this.subscriptionRepository.save(subscription);
    const loaded = await this.subscriptionRepository.findOne({
      where: { id: saved.id },
      relations: ['plan', 'planPrice', 'planPrice.plan'],
    });
    return loaded ?? saved;
  }

  async extendTrial(tenantId: string, additionalDays: number): Promise<TenantSubscription> {
    const subscription = await this.getTenantSubscription(tenantId);
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

    const saved = await this.subscriptionRepository.save(subscription);
    const loaded = await this.subscriptionRepository.findOne({
      where: { id: saved.id },
      relations: ['plan', 'planPrice', 'planPrice.plan'],
    });

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.SUBSCRIPTION_CREATED,
        description: `Trial extended by ${additionalDays} days`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant_subscription',
        resourceId: saved.id,
        tenantId,
        metadata: { additionalDays, newTrialEnd: newEnd.toISOString() },
      })
      .catch(() => {});

    return loaded ?? saved;
  }

  async getCurrentUsage(tenantId: string, usageType: string): Promise<number> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription?.usageMetrics) return 0;
    const value = subscription.usageMetrics[usageType as keyof typeof subscription.usageMetrics];
    return typeof value === 'number' ? value : 0;
  }

  async setTenantRegion(
    tenantId: string,
    data: { countryCode: string; timezone?: string; preferredCurrency?: string },
  ): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.pricingLocked) {
      throw new BadRequestException(
        `Pricing region is locked for tenant ${tenantId} (${tenant.countryCode})`,
      );
    }
    const normalizedCountry = data.countryCode === 'GLOBAL' ? null : data.countryCode;
    const pricingRegion = normalizedCountry ?? 'GLOBAL';
    const defaults = GeoLocationHelper.getCountryDefaults(pricingRegion);
    const storedCountry = GeoLocationHelper.toStoredCountryCode(normalizedCountry);
    tenant.countryCode = storedCountry;
    tenant.timezone = data.timezone ?? defaults.timezone;
    // NG workspaces always lock preferred currency to NGN (billing + wallet).
    if (storedCountry === 'NG') {
      tenant.preferredCurrency = 'NGN';
    } else {
      tenant.preferredCurrency = data.preferredCurrency ?? defaults.currency;
    }
    tenant.pricingLocked = true;
    return this.tenantRepository.save(tenant);
  }

  async setTenantRegionOnboarding(
    tenantId: string,
    ipAddress: string,
    userSelectedCountry?: string,
    options?: {
      headers?: Record<string, string | string[] | undefined>;
      timezone?: string | null;
    },
  ): Promise<{
    tenant: Tenant;
    detectionMethod: 'user_selected' | 'ip_detected' | 'default';
    lockedRegion: string;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.pricingLocked) {
      return {
        tenant,
        detectionMethod: 'user_selected',
        lockedRegion: tenant.countryCode || 'UNKNOWN',
      };
    }

    let countryCode: string;
    let detectionMethod: 'user_selected' | 'ip_detected' | 'default';

    const selected = userSelectedCountry?.trim().toUpperCase();
    if (selected && selected !== 'GLOBAL' && GeoLocationHelper.toStoredCountryCode(selected)) {
      countryCode = selected;
      detectionMethod = 'user_selected';
    } else {
      // Same path as pricing-preview: headers → IP → timezone (e.g. Africa/Lagos → NG).
      const detected = await GeoLocationHelper.resolveDetectedCountry({
        ip: ipAddress,
        headers: options?.headers,
        timezone: options?.timezone,
      });
      countryCode = detected.countryCode;
      detectionMethod = detected.detectionMethod === 'default' ? 'default' : 'ip_detected';
    }

    const updatedTenant = await this.setTenantRegion(tenantId, { countryCode });
    const lockedRegion = countryCode === 'GLOBAL' ? 'GLOBAL' : countryCode;
    return { tenant: updatedTenant, detectionMethod, lockedRegion };
  }

  async getTenantPricing(
    tenantId: string,
    ipAddress?: string,
  ): Promise<{
    countryCode: string;
    pricing: Awaited<ReturnType<PlansService['getPricesForCountry']>>;
    tenant: Tenant;
    subscription?: TenantSubscription;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const countryCode = await GeoLocationHelper.resolveCountryCode({
      ip: ipAddress,
      stored: tenant.countryCode,
    });
    const pricing = await this.plansService.getPricesForCountry(countryCode);
    const subscription = await this.getTenantSubscription(tenantId);

    return {
      countryCode,
      pricing,
      tenant,
      subscription: subscription ?? undefined,
    };
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
    const existing = await this.getTenantSubscription(tenantId);
    if (existing) {
      return existing;
    }

    const tenant = await this.resolveAndLockTenantRegion(tenantId, {
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

    const saved = await this.subscriptionRepository.save(subscription);
    const loaded = await this.subscriptionRepository.findOne({
      where: { id: saved.id },
      relations: ['plan', 'planPrice', 'planPrice.plan'],
    });
    return loaded ?? saved;
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
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription || subscription.status !== SubscriptionStatus.TRIAL) {
      throw new BadRequestException('Trial is not active');
    }

    const tenant = await this.resolveAndLockTenantRegion(tenantId, {
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
    const saved = await this.subscriptionRepository.save(subscription);
    const loaded = await this.subscriptionRepository.findOne({
      where: { id: saved.id },
      relations: ['plan', 'planPrice', 'planPrice.plan'],
    });
    return loaded ?? saved;
  }

  /**
   * NG tenants must use NGN plan_prices. Rebind trial/unpaid USD/GLOBAL rows;
   * for paid ACTIVE on USD, report mismatch (do not change charged product).
   */
  async healNgSubscriptionPlanPrice(
    tenantCountryCode: string | null | undefined,
    subscription: TenantSubscription | null,
  ): Promise<{
    subscription: TenantSubscription | null;
    pricingMismatch: {
      expectedCurrency: 'NGN';
      actualCurrency: string;
      message: string;
    } | null;
  }> {
    if (!subscription || GeoLocationHelper.toStoredCountryCode(tenantCountryCode) !== 'NG') {
      return { subscription, pricingMismatch: null };
    }

    let planPrice = subscription.planPrice;
    if (!planPrice && subscription.planPriceId) {
      const loadedPrice = await this.plansService.getPlanPriceById(subscription.planPriceId);
      if (loadedPrice) {
        planPrice = loadedPrice;
        subscription.planPrice = loadedPrice;
      }
    }
    if (!planPrice) {
      return { subscription, pricingMismatch: null };
    }

    const priceCountry = (planPrice.countryCode ?? '').toUpperCase();
    const priceCurrency = (planPrice.currency ?? '').toUpperCase();
    const needsNgPrice = priceCountry !== 'NG' || priceCurrency !== 'NGN';
    if (!needsNgPrice) {
      return { subscription, pricingMismatch: null };
    }

    const planSlug = (subscription.plan?.slug ?? planPrice.plan?.slug ?? '').trim().toLowerCase();
    if (!planSlug) {
      return { subscription, pricingMismatch: null };
    }

    const ngPrice = await this.plansService.getPlanPrice(planSlug, 'NG', 'NGN');
    if (!ngPrice) {
      return {
        subscription,
        pricingMismatch: {
          expectedCurrency: 'NGN',
          actualCurrency: priceCurrency || 'USD',
          message:
            'Nigerian workspace pricing requires NGN plan prices, but none are seeded for this plan.',
        },
      };
    }

    if (subscription.status === SubscriptionStatus.TRIAL) {
      subscription.planId = ngPrice.planId;
      subscription.planPriceId = ngPrice.id;
      subscription.planPrice = ngPrice;
      if (ngPrice.plan) {
        subscription.plan = ngPrice.plan;
      }
      const saved = await this.subscriptionRepository.save(subscription);
      const loaded = await this.subscriptionRepository.findOne({
        where: { id: saved.id },
        relations: ['plan', 'planPrice', 'planPrice.plan'],
      });
      return { subscription: loaded ?? saved, pricingMismatch: null };
    }

    // Paid / non-trial: do not silently change the charged product.
    if (
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.PAUSED
    ) {
      return {
        subscription,
        pricingMismatch: {
          expectedCurrency: 'NGN',
          actualCurrency: priceCurrency || 'USD',
          message:
            'This Nigerian workspace is on a USD subscription. Cancel and re-subscribe to switch to NGN billing.',
        },
      };
    }

    return { subscription, pricingMismatch: null };
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
    const existing = await this.getTenantSubscription(tenantId);
    if (existing?.status === SubscriptionStatus.TRIAL) {
      return true;
    }
    if (!userId) {
      return true;
    }
    return !(await this.hasUserEverUsedTrial(userId));
  }

  private async findLockedSiblingTenantRegion(
    userId: string,
    excludeTenantId: string,
  ): Promise<{ countryCode: string | null; preferredCurrency: string | null } | null> {
    const sibling = await this.tenantRepository
      .createQueryBuilder('tenant')
      .innerJoin(TenantMember, 'member', 'member.tenantId = tenant.id')
      .where('member.userId = :userId', { userId })
      .andWhere('member.role = :role', { role: TenantMemberRole.OWNER })
      .andWhere('tenant.id != :excludeTenantId', { excludeTenantId })
      .andWhere('tenant.pricingLocked = true')
      .andWhere('tenant.countryCode IS NOT NULL')
      .orderBy('tenant.createdAt', 'ASC')
      .getOne();

    if (!sibling) {
      return null;
    }

    return {
      countryCode: sibling.countryCode,
      preferredCurrency: sibling.preferredCurrency,
    };
  }

  async resolveAndLockTenantRegion(
    tenantId: string,
    options: {
      clientIp?: string | null;
      headers?: Record<string, string | string[] | undefined>;
      userId?: string | null;
    } = {},
  ): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (tenant.pricingLocked) {
      return tenant;
    }

    let userCountryCode: string | null = null;
    let siblingTenant: { countryCode: string | null; preferredCurrency: string | null } | null =
      null;

    if (options.userId) {
      const user = await this.userRepository.findOne({ where: { id: options.userId } });
      userCountryCode = user?.countryCode ?? null;
      siblingTenant = await this.findLockedSiblingTenantRegion(options.userId, tenantId);
    }

    await GeoLocationHelper.autoFillCountryCode(tenant, options.clientIp, options.headers, {
      userCountryCode,
      siblingTenant,
    });

    const storedCountry = GeoLocationHelper.toStoredCountryCode(tenant.countryCode);
    if (storedCountry) {
      return this.setTenantRegion(tenantId, {
        countryCode: storedCountry,
        timezone: tenant.timezone ?? undefined,
        preferredCurrency: tenant.preferredCurrency ?? undefined,
      });
    }

    return tenant;
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
    const existing = await this.getTenantSubscription(tenantId);
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

  async getSupportedCountries(): Promise<
    Array<{
      countryCode: string;
      country: string;
      currency: string;
      timezone: string;
    }>
  > {
    return [
      {
        countryCode: 'NG',
        country: 'Nigeria',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
      {
        countryCode: 'GLOBAL',
        country: 'Global',
        currency: 'USD',
        timezone: 'UTC',
      },
    ];
  }
}
