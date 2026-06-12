import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FeatureAccess, SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
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

  async getTenantSubscription(
    tenantId: string,
  ): Promise<TenantSubscription | null> {
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

  async hasFeatureAccess(
    tenantId: string,
    features: FeatureAccess[],
  ): Promise<boolean> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (
      !subscription ||
      ![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL].includes(
        subscription.status,
      )
    ) {
      return false;
    }
    const planFeatures = subscription.plan?.features ?? {};
    return features.every((feature) => planFeatures[feature] === true);
  }

  async getCurrentUsage(tenantId: string, usageType: string): Promise<number> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription?.usageMetrics) return 0;
    return (
      subscription.usageMetrics[
        usageType as keyof typeof subscription.usageMetrics
      ] ?? 0
    );
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
    const defaults = GeoLocationHelper.getCountryDefaults(data.countryCode);
    tenant.countryCode = data.countryCode.toUpperCase();
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
      detectionMethod =
        countryCode === 'GLOBAL' ? 'default' : 'ip_detected';
    }

    const updatedTenant = await this.setTenantRegion(tenantId, { countryCode });
    return { tenant: updatedTenant, detectionMethod, lockedRegion: countryCode };
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
