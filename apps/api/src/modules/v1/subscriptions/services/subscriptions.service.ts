import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FeatureAccess, SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import {
  isBillingGatewayEnabled,
  isFeatureGatingEnabled,
} from '../config/billing.config';
import type { ActivateSubscriptionDto } from '../dto/activate-subscription.dto';
import { TenantSubscription } from '../entities/tenant-subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly plansService: PlansService,
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
    return this.subscriptionRepository.save(subscription);
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
    return features.every((feature) => planFeatures[feature] === true);
  }

  isSubscriptionEntitled(subscription: TenantSubscription): boolean {
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return true;
    }
    if (subscription.status === SubscriptionStatus.TRIAL) {
      if (!subscription.trialEndsAt) {
        return true;
      }
      return new Date() < subscription.trialEndsAt;
    }
    return false;
  }

  async getBillingStatus(tenantId: string): Promise<{
    paymentsEnabled: boolean;
    featureGatingEnabled: boolean;
    subscription: {
      status: SubscriptionStatus;
      plan: string;
      trialEndsAt: Date | null;
      isOnTrial: boolean;
      daysRemaining: number | null;
      currentPeriodEnd: Date;
    } | null;
  }> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      return {
        paymentsEnabled: isBillingGatewayEnabled(),
        featureGatingEnabled: isFeatureGatingEnabled(),
        subscription: null,
      };
    }

    let daysRemaining: number | null = null;
    if (subscription.trialEndsAt) {
      const ms = subscription.trialEndsAt.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    return {
      paymentsEnabled: isBillingGatewayEnabled(),
      featureGatingEnabled: isFeatureGatingEnabled(),
      subscription: {
        status: subscription.status,
        plan: subscription.plan?.slug ?? subscription.plan?.name ?? 'starter',
        trialEndsAt: subscription.trialEndsAt,
        isOnTrial: subscription.isOnTrial,
        daysRemaining,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    };
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
      const countryCode = tenant.countryCode || 'GLOBAL';
      const planPrice = await this.plansService.getPlanPrice(
        options.planSlug,
        countryCode,
        tenant.preferredCurrency ?? undefined,
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
    return loaded ?? saved;
  }

  async getCurrentUsage(tenantId: string, usageType: string): Promise<number> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription?.usageMetrics) return 0;
    return subscription.usageMetrics[usageType as keyof typeof subscription.usageMetrics] ?? 0;
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
    const pricingRegion = GeoLocationHelper.toPricingRegion(data.countryCode);
    const defaults = GeoLocationHelper.getCountryDefaults(pricingRegion);
    tenant.countryCode = GeoLocationHelper.toStoredCountryCode(data.countryCode);
    tenant.timezone = data.timezone ?? defaults.timezone;
    tenant.preferredCurrency = data.preferredCurrency ?? defaults.currency;
    tenant.pricingLocked = true;
    return this.tenantRepository.save(tenant);
  }

  async setTenantRegionOnboarding(
    tenantId: string,
    ipAddress: string,
    userSelectedCountry?: string,
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

    if (userSelectedCountry) {
      countryCode = userSelectedCountry.toUpperCase();
      detectionMethod = 'user_selected';
    } else {
      countryCode = await GeoLocationHelper.getCountryCode(ipAddress);
      detectionMethod = countryCode === 'GLOBAL' ? 'default' : 'ip_detected';
    }

    const updatedTenant = await this.setTenantRegion(tenantId, { countryCode });
    const lockedRegion = GeoLocationHelper.toPricingRegion(countryCode);
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
    options?: { trialDays?: number; planSlug?: string },
  ): Promise<TenantSubscription> {
    const existing = await this.getTenantSubscription(tenantId);
    if (existing) {
      return existing;
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const countryCode = tenant.countryCode || 'GLOBAL';
    const planSlug = options?.planSlug ?? 'starter';
    const planPrice = await this.plansService.getPlanPrice(
      planSlug,
      countryCode,
      tenant.preferredCurrency ?? undefined,
    );

    if (!planPrice) {
      throw new BadRequestException(
        `Plan "${planSlug}" not found for region ${countryCode}. Ensure plans are seeded.`,
      );
    }

    const trialDays = options?.trialDays ?? 14;
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
