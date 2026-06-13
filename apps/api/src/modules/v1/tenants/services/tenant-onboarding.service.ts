import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { StringUtility } from 'src/common/utils/string.util';
import { PlansService } from '../../plans/services/plans.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSubscription } from '../../subscriptions/entities/tenant-subscription.entity';
import { Tenant } from '../entities/tenant.entity';
import {
  TenantCreatedEvent,
  TenantMemberCreatedEvent,
} from '../../leave/events/leave.events';
import { OnboardingData } from "../../../../common/interfaces/onboarding-data.interface";
import { OnboardingResult } from "../../../../common/interfaces/onboarding-result.interface";

@Injectable()
export class TenantOnboardingService {
  private readonly logger = new Logger(TenantOnboardingService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private subscriptionsService: SubscriptionsService,
    private plansService: PlansService,
    private tenantMembersService: TenantMembersService,
    private eventEmitter: EventEmitter2,
  ) {}

  async completeTenantOnboarding(
    data: OnboardingData,
    userIpAddress: string,
  ): Promise<OnboardingResult> {
    this.logger.log(`Starting onboarding for tenant: ${data.name}`);

    const tenant = await this.createTenant(data);
    const member = await this.tenantMembersService.createTenantMember(
      data.createdBy!,
      tenant.id,
      { role: TenantMemberRole.OWNER },
    );
    this.emitTenantSetupEvents(tenant, member, data.name);
    const pricingResult =
      await this.subscriptionsService.setTenantRegionOnboarding(
        tenant.id,
        userIpAddress,
        data.businessCountry,
      );
    const subscription = await this.subscriptionsService.createTrialSubscription(
      pricingResult.tenant.id,
    );

    this.logger.log(
      `Onboarding completed for ${data.name} — locked to ${pricingResult.lockedRegion} (${pricingResult.detectionMethod})`,
    );

    const defaults = GeoLocationHelper.getCountryDefaults(
      pricingResult.lockedRegion,
    );

    return {
      tenant: pricingResult.tenant,
      pricingRegion: {
        countryCode: pricingResult.lockedRegion,
        region: pricingResult.lockedRegion,
        currency: pricingResult.tenant.preferredCurrency || defaults.currency,
        detectionMethod: pricingResult.detectionMethod,
        isLocked: pricingResult.tenant.pricingLocked,
      },
      subscription: this.mapSubscriptionSummary(pricingResult.tenant, subscription),
    };
  }

  async getPricingPreview(
    countryCode?: string,
    ipAddress?: string,
  ): Promise<{
    detectedCountry: string;
    currency: string;
    pricing: Awaited<ReturnType<PlansService['getPricesForCountry']>>;
    detectionMethod: string;
  }> {
    const detectedCountry = await GeoLocationHelper.resolveCountryCode({
      ip: ipAddress,
      stored: countryCode,
    });
    const defaults = GeoLocationHelper.getCountryDefaults(detectedCountry);
    const pricing =
      await this.plansService.getPricesForCountry(detectedCountry);

    return {
      detectedCountry,
      currency: defaults.currency,
      pricing,
      detectionMethod: countryCode
        ? 'stored'
        : ipAddress
          ? 'ip'
          : 'default',
    };
  }

  async canChangePricingRegion(tenantId: string): Promise<{
    canChange: boolean;
    reason?: string;
    currentRegion?: string;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      return { canChange: false, reason: 'Tenant not found' };
    }
    if (tenant.pricingLocked) {
      return {
        canChange: false,
        reason: 'Pricing region is permanently locked',
        currentRegion: tenant.countryCode || 'Unknown',
      };
    }
    return { canChange: true };
  }

  async getTenantPricingInfo(tenantId: string): Promise<{
    isLocked: boolean;
    countryCode?: string;
    currency?: string;
    lockedAt?: Date;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (!tenant.pricingLocked) {
      return { isLocked: false };
    }
    return {
      isLocked: true,
      countryCode: tenant.countryCode || undefined,
      currency: tenant.preferredCurrency || undefined,
      lockedAt: tenant.updatedAt,
    };
  }

  private async createTenant(data: OnboardingData): Promise<Tenant> {
    const tenant = this.tenantRepository.create({
      name: data.name,
      slug: this.generateSlug(data.name),
      industry: data.industry,
      companySize: data.companySize,
      inviteCode: this.generateInviteCode(),
      createdBy: { id: data.createdBy } as Tenant['createdBy'],
    });
    const saved = await this.tenantRepository.save(tenant);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  private mapSubscriptionSummary(
    tenant: Tenant,
    subscription: TenantSubscription,
  ): {
    plan: string;
    status: string;
    currency: string;
    trialEndsAt: Date | null;
    pricingLocked: boolean;
  } {
    const defaults = GeoLocationHelper.getCountryDefaults(
      tenant.countryCode || 'GLOBAL',
    );
    return {
      plan: subscription.plan?.slug ?? subscription.plan?.name ?? 'starter',
      status: subscription.status,
      currency: tenant.preferredCurrency || defaults.currency,
      trialEndsAt: subscription.trialEndsAt,
      pricingLocked: tenant.pricingLocked,
    };
  }

  private emitTenantSetupEvents(
    tenant: Tenant,
    member: TenantMember,
    companyName: string,
  ): void {
    this.eventEmitter.emit(
      'tenant.created',
      new TenantCreatedEvent(tenant.id, member.id, tenant),
    );
    this.eventEmitter.emit(
      'tenant.member.created',
      new TenantMemberCreatedEvent(tenant.id, member.id, member.joinDate),
    );
    this.eventEmitter.emit('tenant.settings.initialize', {
      tenantId: tenant.id,
      companyName,
      defaultSettings: {
        general: { companyName },
        attendance: { weekends: [0, 6] },
      },
    });
  }

  private generateSlug(name: string): string {
    const suffix = randomBytes(3).toString('hex');
    const maxBaseLength = 25 - 1 - suffix.length;
    let base = StringUtility.slugify(name)
      .slice(0, maxBaseLength)
      .replace(/-+$/, '');
    if (!base) {
      base = 't';
    }
    return `${base}-${suffix}`;
  }

  private generateInviteCode(): string {
    return randomBytes(3).toString('hex').toUpperCase();
  }
}
