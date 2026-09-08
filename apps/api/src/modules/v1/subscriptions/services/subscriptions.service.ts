import { Injectable } from '@nestjs/common';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import type { ActivateSubscriptionDto } from '../dto/activate-subscription.dto';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import {
  type NeedsPaymentInput,
  SubscriptionEntitlementService,
  type TenantEntitlementSnapshot,
} from './subscription-entitlement.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionRegionService } from './subscription-region.service';

export type { NeedsPaymentInput, TenantEntitlementSnapshot };

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly entitlementService: SubscriptionEntitlementService,
    private readonly lifecycleService: SubscriptionLifecycleService,
    private readonly regionService: SubscriptionRegionService,
  ) {}

  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
    return this.entitlementService.getTenantSubscription(tenantId);
  }

  async updateTenantSubscription(
    tenantId: string,
    updates: Partial<TenantSubscription>,
  ): Promise<TenantSubscription> {
    return this.entitlementService.updateTenantSubscription(tenantId, updates);
  }

  async getEntitlementsForTenants(
    tenantIds: string[],
  ): Promise<Map<string, TenantEntitlementSnapshot>> {
    return this.entitlementService.getEntitlementsForTenants(tenantIds);
  }

  async hasFeatureAccess(tenantId: string, features: FeatureAccess[]): Promise<boolean> {
    return this.entitlementService.hasFeatureAccess(tenantId, features);
  }

  isSubscriptionEntitled(subscription: TenantSubscription): boolean {
    return this.entitlementService.isSubscriptionEntitled(subscription);
  }

  async getBillingStatus(tenantId: string) {
    return this.entitlementService.getBillingStatus(tenantId);
  }

  computeNeedsPayment(subscription: NeedsPaymentInput): boolean {
    return this.entitlementService.computeNeedsPayment(subscription);
  }

  async getCurrentUsage(tenantId: string, usageType: string): Promise<number> {
    return this.entitlementService.getCurrentUsage(tenantId, usageType);
  }

  async activateTenantSubscription(
    tenantId: string,
    options: ActivateSubscriptionDto = {},
  ): Promise<TenantSubscription> {
    return this.lifecycleService.activateTenantSubscription(tenantId, options);
  }

  async extendTrial(tenantId: string, additionalDays: number): Promise<TenantSubscription> {
    return this.lifecycleService.extendTrial(tenantId, additionalDays);
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
    return this.lifecycleService.createTrialSubscription(tenantId, options);
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
    return this.lifecycleService.setTrialPlan(tenantId, planSlug, options);
  }

  async hasUserEverUsedTrial(userId: string): Promise<boolean> {
    return this.lifecycleService.hasUserEverUsedTrial(userId);
  }

  async isTrialEligible(userId: string | null | undefined, tenantId: string): Promise<boolean> {
    return this.lifecycleService.isTrialEligible(userId, tenantId);
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
    return this.lifecycleService.startTrial(tenantId, planSlug, options);
  }

  async setTenantRegion(
    tenantId: string,
    data: { countryCode: string; timezone?: string; preferredCurrency?: string },
  ) {
    return this.regionService.setTenantRegion(tenantId, data);
  }

  async setTenantRegionOnboarding(
    tenantId: string,
    ipAddress: string,
    userSelectedCountry?: string,
    options?: {
      headers?: Record<string, string | string[] | undefined>;
      timezone?: string | null;
    },
  ) {
    return this.regionService.setTenantRegionOnboarding(
      tenantId,
      ipAddress,
      userSelectedCountry,
      options,
    );
  }

  async getTenantPricing(tenantId: string, ipAddress?: string) {
    return this.regionService.getTenantPricing(tenantId, ipAddress);
  }

  async resolveAndLockTenantRegion(
    tenantId: string,
    options: {
      clientIp?: string | null;
      headers?: Record<string, string | string[] | undefined>;
      userId?: string | null;
    } = {},
  ) {
    return this.regionService.resolveAndLockTenantRegion(tenantId, options);
  }

  async healNgSubscriptionPlanPrice(
    tenantCountryCode: string | null | undefined,
    subscription: TenantSubscription | null,
  ) {
    return this.regionService.healNgSubscriptionPlanPrice(tenantCountryCode, subscription);
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
