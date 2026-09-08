import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { SubscriptionEntitlementService } from './subscription-entitlement.service';

@Injectable()
export class SubscriptionRegionService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    private readonly plansService: PlansService,
    private readonly entitlementService: SubscriptionEntitlementService,
  ) {}

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
    const subscription = await this.entitlementService.getTenantSubscription(tenantId);

    return {
      countryCode,
      pricing,
      tenant,
      subscription: subscription ?? undefined,
    };
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
}
