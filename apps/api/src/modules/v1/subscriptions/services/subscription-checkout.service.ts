import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import {
  isAllowedTenantFrontendOrigin,
  isSubdomainTenantsEnabled,
  tenantFrontendUrl,
} from 'src/common/utils/tenant-frontend-url.util';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import type { SubscriptionBillingMetadata } from '../interfaces/subscription-billing.interface';
import { calculatePerSeatTotal } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { SeatPricingCalculator } from './seat-pricing-calculator';
import { SubscriptionsService } from './subscriptions.service';

export class SubscriptionCheckoutService {
  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(TenantMember) private readonly tenantMemberRepo: Repository<TenantMember>,
    private readonly seatPricing: SeatPricingCalculator,
  ) {}

  private providerForCountry(countryCode: string | null | undefined): BillingProvider {
    return this.billingProviderFactory.resolveBillingProvider(countryCode);
  }

  async createSubscriptionCheckout(
    tenantId: string,
    planSlug: string,
    userId: string,
    successUrl?: string,
    clientIp?: string | null,
    headers?: Record<string, string | string[] | undefined>,
  ) {
    const normalizedSlug = planSlug.trim().toLowerCase();
    const plan = await this.plansService.findPlanBySlug(normalizedSlug);
    if (!plan?.isActive) throw new BadRequestException('Invalid or inactive plan');

    const [tenant, user, existing] = await Promise.all([
      this.tenantRepo.findOne({ where: { id: tenantId } }),
      this.userRepo.findOne({ where: { id: userId } }),
      this.subscriptionsService.getTenantSubscription(tenantId),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!user) throw new NotFoundException('User not found');

    await this.subscriptionsService.resolveAndLockTenantRegion(tenantId, {
      clientIp,
      headers,
      userId,
    });
    const lockedTenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!lockedTenant) throw new NotFoundException('Tenant not found');

    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      lockedTenant.countryCode,
      lockedTenant.preferredCurrency,
    );
    const currentPlanSlug =
      existing?.plan?.slug?.toLowerCase() ?? existing?.plan?.name?.toLowerCase();
    const billingProvider = this.providerForCountry(countryCode);

    if (
      existing &&
      currentPlanSlug === normalizedSlug &&
      existing.billingProvider === billingProvider &&
      existing.status === SubscriptionStatus.ACTIVE
    ) {
      throw new BadRequestException('Already has active subscription on this plan');
    }
    if (
      existing?.status === SubscriptionStatus.ACTIVE &&
      existing.nextBillingDate > new Date() &&
      currentPlanSlug === normalizedSlug &&
      existing.billingProvider === billingProvider
    ) {
      throw new BadRequestException('Subscription is already paid through current period');
    }
    if (
      existing?.status === SubscriptionStatus.PAST_DUE &&
      existing.paymentMethodId?.trim() &&
      existing.billingProvider === billingProvider &&
      !isManagedSubscriptionProvider(billingProvider)
    ) {
      throw new BadRequestException('Saved payment method will be retried. Update card instead.');
    }
    if (
      existing?.status === SubscriptionStatus.PAST_DUE &&
      existing.externalSubscriptionId?.trim() &&
      isManagedSubscriptionProvider(billingProvider)
    ) {
      throw new BadRequestException('Past due with active provider subscription.');
    }

    const planPrice = await this.plansService.getPlanPrice(normalizedSlug, countryCode, currency);
    if (!planPrice)
      throw new NotFoundException(`Plan "${normalizedSlug}" not available for your region`);

    this.billingProviderFactory.ensureConfigured(countryCode);
    const quantity = await this.seatPricing.getTenantSeatCount(tenantId);
    const tenantMember = await this.tenantMemberRepo.findOne({ where: { tenantId, userId } });
    const metadata: SubscriptionBillingMetadata = {
      tenantId,
      userId,
      tenantMemberId: tenantMember?.id,
      planId: planPrice.planId,
      planPriceId: planPrice.id,
      quantity,
    };

    const checkout = await this.billingProviderFactory
      .getProviderForCountry(countryCode)
      .createCheckout(
        user.email,
        metadata,
        planPrice,
        this.resolveSuccessUrl(tenant.slug, successUrl),
        quantity,
      );
    return {
      ...checkout,
      planSlug: normalizedSlug,
      seatCount: quantity,
      amount: calculatePerSeatTotal(planPrice, quantity),
      currency: planPrice.currency,
      billingProvider,
    };
  }

  async createPaymentMethodUpdateCheckout(tenantId: string, userId: string, successUrl?: string) {
    const [tenant, user, subscription] = await Promise.all([
      this.tenantRepo.findOne({ where: { id: tenantId }, relations: ['createdBy'] }),
      this.userRepo.findOne({ where: { id: userId } }),
      this.subscriptionsService.getTenantSubscription(tenantId),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!user) throw new NotFoundException('User not found');
    if (!subscription?.planPriceId) throw new BadRequestException('No subscription to update');

    const metadata: SubscriptionBillingMetadata = {
      tenantId,
      userId,
      planId: subscription.planId,
      planPriceId: subscription.planPriceId,
    };
    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      tenant.countryCode,
      planPrice?.currency ?? tenant.preferredCurrency,
    );
    const billingProvider = this.providerForCountry(countryCode);
    this.billingProviderFactory.ensureConfigured(countryCode);

    const providerService = this.billingProviderFactory.getProviderForCountry(countryCode);
    if (!providerService.createCardUpdateCheckout)
      throw new BadRequestException('Card update not supported for this provider');
    const checkout = await providerService.createCardUpdateCheckout(
      tenant.createdBy?.email ?? user.email,
      metadata,
      this.resolveSuccessUrl(tenant.slug, successUrl),
      currency,
    );
    return { ...checkout, currency, billingProvider };
  }

  private resolveSuccessUrl(tenantSlug: string, successUrl?: string): string {
    const fallback = tenantFrontendUrl(tenantSlug, '/settings?billing=success');
    if (!successUrl?.trim()) return fallback;
    let parsed: URL;
    try {
      parsed = new URL(successUrl);
    } catch {
      throw new BadRequestException('Invalid success URL');
    }
    if (!isAllowedTenantFrontendOrigin(tenantSlug, parsed.origin))
      throw new BadRequestException('Success URL must use application frontend origin');
    if (isSubdomainTenantsEnabled()) {
      if (parsed.pathname.startsWith(`/${tenantSlug}/`))
        throw new BadRequestException('Success URL must not include workspace slug');
    } else if (!parsed.pathname.startsWith(`/${tenantSlug}/`))
      throw new BadRequestException('Success URL must stay within workspace path');
    return successUrl;
  }
}
