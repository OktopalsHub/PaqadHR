import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { StringUtility } from 'src/common/utils/string.util';
import { Repository } from 'typeorm';
import { RESERVED_TENANT_SLUGS } from '../../../../common/constants/reserved-tenant-slugs';
import type { OnboardingData } from '../../../../common/interfaces/onboarding-data.interface';
import type { OnboardingResult } from '../../../../common/interfaces/onboarding-result.interface';
import { TenantCreatedEvent, TenantMemberCreatedEvent } from '../../leave/events/leave.events';
import { PlansService } from '../../plans/services/plans.service';
import { PositionService } from '../../position/services/position.service';
import { PositionMemberService } from '../../position/services/position-member.service';
import type { TenantSubscription } from '../../subscriptions/entities/tenant-subscription.entity';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { Tenant } from '../entities/tenant.entity';

const SLUG_MAX_LENGTH = 25;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugAvailabilityResult = {
  slug: string;
  available: boolean;
  reason?: 'invalid' | 'reserved' | 'taken';
};

@Injectable()
export class TenantOnboardingService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private subscriptionsService: SubscriptionsService,
    private plansService: PlansService,
    private tenantMembersService: TenantMembersService,
    private usersService: UsersService,
    private positionService: PositionService,
    private positionMemberService: PositionMemberService,
    private eventEmitter: EventEmitter2,
  ) {}

  async completeTenantOnboarding(
    data: OnboardingData,
    userIpAddress: string,
  ): Promise<OnboardingResult> {
    const tenant = await this.createTenant(data);
    const user = await this.usersService.getUser(data.createdBy!);
    const { firstName, lastName } = this.resolveMemberNames(data, user);
    const member = await this.tenantMembersService.createTenantMember(data.createdBy!, tenant.id, {
      role: TenantMemberRole.OWNER,
      firstName,
      lastName,
      preferredName: data.preferredName?.trim() || firstName || undefined,
    });
    if (data.jobTitle?.trim()) {
      const position = await this.positionService.createPosition(tenant.id, {
        title: data.jobTitle.trim(),
      });
      await this.positionMemberService.assignPosition(tenant.id, member.id, position.id);
    }
    this.emitTenantSetupEvents(tenant, member, data.name);
    const pricingResult = await this.subscriptionsService.setTenantRegionOnboarding(
      tenant.id,
      userIpAddress,
      data.businessCountry,
    );
    const subscription = await this.subscriptionsService.createTrialSubscription(
      pricingResult.tenant.id,
      { planSlug: data.planSlug ?? 'starter' },
    );

    const defaults = GeoLocationHelper.getCountryDefaults(pricingResult.lockedRegion);

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
    options?: {
      headers?: Record<string, string | string[] | undefined>;
      timezone?: string;
    },
  ): Promise<{
    detectedCountry: string;
    currency: string;
    pricing: Awaited<ReturnType<PlansService['getPricesForCountry']>>;
    detectionMethod: string;
  }> {
    const { countryCode: detectedCountry, detectionMethod } =
      await GeoLocationHelper.resolveDetectedCountry({
        ip: ipAddress,
        stored: countryCode,
        headers: options?.headers,
        timezone: options?.timezone,
      });
    const pricingRegion = GeoLocationHelper.toPricingRegion(detectedCountry);
    const defaults = GeoLocationHelper.getCountryDefaults(pricingRegion);
    const pricing = await this.plansService.getPricesForCountry(pricingRegion);

    return {
      detectedCountry: pricingRegion,
      currency: defaults.currency,
      pricing,
      detectionMethod,
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

  async checkSlugAvailability(rawSlug: string): Promise<SlugAvailabilityResult> {
    const slug = this.normalizeSlug(rawSlug);

    if (!slug || slug.length < 2 || !SLUG_PATTERN.test(slug)) {
      return { slug, available: false, reason: 'invalid' };
    }

    if (this.isSlugReserved(slug)) {
      return { slug, available: false, reason: 'reserved' };
    }

    const existing = await this.tenantRepository.findOne({ where: { slug } });
    if (existing) {
      return { slug, available: false, reason: 'taken' };
    }

    return { slug, available: true };
  }

  private async createTenant(data: OnboardingData): Promise<Tenant> {
    const slug = await this.resolveSlug(data);
    const employeeCode = (data.employeeCode || this.generateEmployeeCode(data.name) || 'EMP')
      .trim()
      .toUpperCase();
    const tenant = this.tenantRepository.create({
      name: data.name,
      slug,
      industry: data.industry,
      companySize: data.companySize,
      inviteCode: this.generateInviteCode(),
      employeeCode,
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
    const defaults = GeoLocationHelper.getCountryDefaults(tenant.countryCode || 'GLOBAL');
    return {
      plan: subscription.plan?.slug ?? subscription.plan?.name ?? 'starter',
      status: subscription.status,
      currency: tenant.preferredCurrency || defaults.currency,
      trialEndsAt: subscription.trialEndsAt,
      pricingLocked: tenant.pricingLocked,
    };
  }

  private emitTenantSetupEvents(tenant: Tenant, member: TenantMember, companyName: string): void {
    this.eventEmitter.emit('tenant.created', new TenantCreatedEvent(tenant.id, member.id, tenant));
    this.eventEmitter.emit(
      'tenant.member.created',
      new TenantMemberCreatedEvent(tenant.id, member.id, member.joinDate),
    );
    this.eventEmitter.emit('tenant.settings.initialize', {
      tenantId: tenant.id,
      companyName,
      employeeCode: tenant.employeeCode,
      defaultSettings: {
        general: { companyName },
        attendance: { weekends: [0, 6] },
      },
    });
  }

  private async resolveSlug(data: OnboardingData): Promise<string> {
    if (data.slug?.trim()) {
      const availability = await this.checkSlugAvailability(data.slug);
      if (!availability.available) {
        const message =
          availability.reason === 'taken'
            ? 'This slug is already taken.'
            : availability.reason === 'reserved'
              ? 'This slug is reserved.'
              : 'Use 2–25 lowercase letters, numbers, and hyphens.';
        throw new BadRequestException(message);
      }
      return availability.slug;
    }
    return this.generateSlug(data.name);
  }

  private normalizeSlug(rawSlug: string): string {
    return StringUtility.slugify(rawSlug).slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '');
  }

  private isSlugReserved(slug: string): boolean {
    if (RESERVED_TENANT_SLUGS.has(slug)) {
      return true;
    }
    const excluded = (
      process.env.TENANT_EXCLUDED_SUBDOMAINS ||
      process.env.EXCLUDED_SUBDOMAINS ||
      ''
    )
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return excluded.includes(slug);
  }

  private generateSlug(name: string): string {
    const suffix = randomBytes(3).toString('hex');
    const maxBaseLength = 25 - 1 - suffix.length;
    let base = StringUtility.slugify(name).slice(0, maxBaseLength).replace(/-+$/, '');
    if (!base) {
      base = 't';
    }
    return `${base}-${suffix}`;
  }

  private generateInviteCode(): string {
    return randomBytes(3).toString('hex').toUpperCase();
  }

  private resolveMemberNames(
    data: OnboardingData,
    user: User,
  ): { firstName: string; lastName: string } {
    const firstName = data.firstName?.trim() ?? '';
    const lastName = data.lastName?.trim() ?? '';
    if (firstName || lastName) {
      return { firstName, lastName };
    }
    if (user.name?.trim()) {
      const parts = user.name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
      }
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    return { firstName: '', lastName: '' };
  }

  private generateEmployeeCode(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 3).toUpperCase();
    }
    if (parts.length === 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }
}
