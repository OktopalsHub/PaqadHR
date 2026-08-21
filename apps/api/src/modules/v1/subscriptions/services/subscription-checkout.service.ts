import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { CARD_UPDATE_VERIFY_AMOUNT } from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionBillingMetadata } from '../interfaces/subscription-billing.interface';
import { calculatePerSeatTotal } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';

/**
 * Handles subscription and payment method checkout operations.
 * Responsible for creating checkout sessions for new subscriptions and card updates.
 */
@Injectable()
export class SubscriptionCheckoutService {
  private readonly logger = new Logger(SubscriptionCheckoutService.name);

  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly plansService: PlansService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
  ) {}

  private providerForCountry(countryCode: string | null | undefined): BillingProvider {
    return this.billingProviderFactory.resolveBillingProvider(countryCode);
  }

  private async resolveBillingEmail(
    tenantId: string,
    fallbackEmail?: string | null,
  ): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) {
        return contactEmail;
      }
    } catch {}
    return fallbackEmail?.trim() || null;
  }

  private resolveSuccessUrl(tenantSlug: string, successUrl?: string): string {
    const tenantFrontendUrl = (slug: string) => `https://${slug}.paqad.com`;
    const isSubdomainTenantsEnabled = () => true;
    const isAllowedTenantFrontendOrigin = (url: string) => url.includes('paqad.com');

    if (successUrl?.trim()) {
      try {
        const parsed = new URL(successUrl);
        if (isAllowedTenantFrontendOrigin(parsed.origin)) {
          return successUrl;
        }
      } catch {}
    }
    if (isSubdomainTenantsEnabled()) {
      return `${tenantFrontendUrl(tenantSlug)}/settings/billing?success=true`;
    }
    return `${tenantFrontendUrl('app')}/t/${tenantSlug}/settings/billing?success=true`;
  }

  async getTenantSeatCount(tenantId: string): Promise<number> {
    const count = await this.tenantMemberRepository.count({
      where: { tenantId, isActive: true },
    });
    // Ensure minimum of 1 seat
    return Math.max(1, count);
  }

  private async cancelManagedExternalSubscription(
    subscription: TenantSubscription,
    atPeriodEnd: boolean,
  ): Promise<void> {
    if (!isManagedSubscriptionProvider(subscription.billingProvider)) {
      return;
    }
    const externalId = subscription.externalSubscriptionId?.trim();
    if (!externalId) {
      return;
    }
    try {
      await this.billingProviderFactory.cancelExternalSubscription(
        subscription.billingProvider,
        externalId,
        atPeriodEnd,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to cancel ${subscription.billingProvider} subscription ${externalId} for tenant ${subscription.tenantId}: ${message}`,
      );
      throw new BadRequestException(
        'Could not cancel your current billing subscription. Contact support before switching providers.',
      );
    }
  }

  private async prepareBillingProviderSwitch(
    subscription: TenantSubscription,
    targetProvider: BillingProvider,
  ): Promise<void> {
    if (subscription.billingProvider === targetProvider) {
      return;
    }

    if (isManagedSubscriptionProvider(subscription.billingProvider)) {
      await this.cancelManagedExternalSubscription(subscription, false);
      subscription.externalSubscriptionId = null;
    }

    subscription.billingProvider = targetProvider;
    await this.subscriptionRepository.save(subscription);
  }

  async createSubscriptionCheckout(
    tenantId: string,
    planSlug: string,
    userId: string,
    successUrl?: string,
    clientIp?: string | null,
  ) {
    const normalizedSlug = planSlug.trim().toLowerCase();
    const plan = await this.plansService.findPlanBySlug(normalizedSlug);
    if (!plan?.isActive) {
      throw new BadRequestException('Invalid or inactive plan');
    }

    const [tenant, user, existing] = await Promise.all([
      this.tenantRepository.findOne({ where: { id: tenantId } }),
      this.userRepository.findOne({ where: { id: userId } }),
      this.subscriptionsService.getTenantSubscription(tenantId),
    ]);

    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!user) throw new NotFoundException('User not found');

    await GeoLocationHelper.autoFillCountryCode(tenant, clientIp);
    if (GeoLocationHelper.toStoredCountryCode(tenant.countryCode)) {
      await this.tenantRepository.save(tenant);
    }

    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      tenant.countryCode,
      tenant.preferredCurrency,
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
      throw new BadRequestException('Organization already has an active subscription on this plan');
    }

    if (
      existing?.status === SubscriptionStatus.ACTIVE &&
      existing.nextBillingDate > new Date() &&
      currentPlanSlug === normalizedSlug &&
      existing.billingProvider === billingProvider
    ) {
      throw new BadRequestException(
        'Subscription is already paid through the current billing period',
      );
    }

    if (
      existing?.status === SubscriptionStatus.PAST_DUE &&
      existing.paymentMethodId?.trim() &&
      existing.billingProvider === billingProvider &&
      !isManagedSubscriptionProvider(billingProvider)
    ) {
      throw new BadRequestException(
        'Your saved payment method will be retried automatically. Update your card in billing settings instead of checking out again.',
      );
    }

    if (
      existing?.status === SubscriptionStatus.PAST_DUE &&
      existing.externalSubscriptionId?.trim() &&
      isManagedSubscriptionProvider(billingProvider)
    ) {
      throw new BadRequestException(
        'Your subscription payment is past due with an active provider subscription. Update your payment method or wait for the provider retry instead of starting a new checkout.',
      );
    }

    if (existing && existing.billingProvider !== billingProvider) {
      await this.prepareBillingProviderSwitch(existing, billingProvider);
    }

    const planPrice = await this.plansService.getPlanPrice(normalizedSlug, countryCode, currency);
    if (!planPrice) {
      this.logger.warn(
        `Checkout blocked: plan "${normalizedSlug}" not available for tenant=${tenantId} country=${countryCode} currency=${currency}`,
      );
      throw new NotFoundException(`Plan "${normalizedSlug}" is not available for your region`);
    }

    this.billingProviderFactory.ensureConfigured(countryCode);

    const quantity = await this.getTenantSeatCount(tenantId);
    const tenantMember = await this.tenantMemberRepository.findOne({ where: { tenantId, userId } });

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
      this.tenantRepository.findOne({ where: { id: tenantId }, relations: ['createdBy'] }),
      this.userRepository.findOne({ where: { id: userId } }),
      this.subscriptionsService.getTenantSubscription(tenantId),
    ]);

    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!user) throw new NotFoundException('User not found');
    if (!subscription?.planPriceId) {
      throw new BadRequestException('No subscription found to update payment method for');
    }

    const billingEmail = await this.resolveBillingEmail(tenantId, tenant.createdBy?.email);
    const email = billingEmail ?? user.email;

    const metadata: SubscriptionBillingMetadata = {
      tenantId,
      userId,
      planId: subscription.planId,
      planPriceId: subscription.planPriceId,
    };

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    const { countryCode: effectiveCountry, currency } =
      GeoLocationHelper.resolveEffectiveCountryAndCurrency(
        tenant.countryCode,
        planPrice?.currency ?? tenant.preferredCurrency,
      );
    const billingProvider = this.providerForCountry(effectiveCountry);

    this.billingProviderFactory.ensureConfigured(effectiveCountry);

    const billingProviderService =
      this.billingProviderFactory.getProviderForCountry(effectiveCountry);
    if (!billingProviderService.createCardUpdateCheckout) {
      throw new BadRequestException('Payment method updates are not supported for this provider');
    }
    const checkout = await billingProviderService.createCardUpdateCheckout(
      email,
      metadata,
      this.resolveSuccessUrl(tenant.slug, successUrl),
      currency,
    );

    return { ...checkout, currency, billingProvider };
  }
}
