import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import {
  isAllowedTenantFrontendOrigin,
  isSubdomainTenantsEnabled,
  tenantFrontendUrl,
} from 'src/common/utils/tenant-frontend-url.util';
import { Repository } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import type { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type { SubscriptionBillingMetadata } from '../interfaces/subscription-billing.interface';
import { getBillingFailureMessage } from '../utils/nomba-billing-failure.util';
import { calculatePerSeatTotal } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { type RenewalJobResult, RenewalProcessor } from './renewal-processor';
import { SeatPricingCalculator } from './seat-pricing-calculator';
import { SubscriptionsService } from './subscriptions.service';
import { WebhookDispatcher } from './webhook-dispatcher';

@Injectable()
export class SubscriptionBillingService {
  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly plansService: PlansService,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(TenantMember) private readonly tenantMemberRepo: Repository<TenantMember>,
    @InjectRepository(BillingEvent) readonly _billingEventRepo: Repository<BillingEvent>,
    private readonly webhookDispatcher: WebhookDispatcher,
    private readonly renewalProcessor: RenewalProcessor,
    private readonly seatPricing: SeatPricingCalculator,
    readonly _notificationHelper?: NotificationHelperService,
  ) {}

  private providerForCountry(countryCode: string | null | undefined): BillingProvider {
    return this.billingProviderFactory.resolveBillingProvider(countryCode);
  }

  async getTenantSeatCount(tenantId: string): Promise<number> {
    return this.seatPricing.getTenantSeatCount(tenantId);
  }

  async getBillingOverview(tenantId: string, canManageBilling: boolean, userId?: string | null) {
    const [tenant, billingStatus, seatCount, rawSubscription, tenantSettings] = await Promise.all([
      this.tenantRepo.findOne({ where: { id: tenantId }, relations: ['createdBy'] }),
      this.subscriptionsService.getBillingStatus(tenantId),
      this.seatPricing.getTenantSeatCount(tenantId),
      this.subscriptionsService.getTenantSubscription(tenantId),
      this.tenantSettingsService.getTenantSettings(tenantId).catch(() => null),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const { subscription: alignedSubscription, pricingMismatch } =
      await this.subscriptionsService.healNgSubscriptionPlanPrice(
        tenant.countryCode,
        rawSubscription,
      );
    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      tenant.countryCode,
      tenant.preferredCurrency,
    );
    const planPrices = await this.plansService.getPricesForCountry(countryCode);
    const plans = planPrices
      .filter((p) => p.plan?.isActive)
      .map((p) => this.toPlanQuote(p, seatCount))
      .sort((a, b) => a.name.localeCompare(b.name));
    const sub = billingStatus.subscription;
    const needsPayment = this.subscriptionsService.computeNeedsPayment(sub);
    const trialEligible = await this.subscriptionsService.isTrialEligible(userId, tenantId);
    const billingHistory = (alignedSubscription?.billingHistory ?? [])
      .filter((e) => !(e.status === 'paid' && Number(e.amount) === 0))
      .map((e) => ({
        date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
        amount: e.amount,
        currency: e.currency,
        status: e.status,
        invoiceId: e.invoiceId ?? null,
        failureReason: e.failureReason ?? null,
      }));

    return {
      ...billingStatus,
      seatCount,
      countryCode,
      currency: plans[0]?.currency ?? currency,
      canManageBilling,
      plans,
      companyName: tenant.name,
      nextBillingDate: alignedSubscription?.nextBillingDate?.toISOString() ?? null,
      hasPaymentMethodOnFile: Boolean(
        alignedSubscription?.nombaSubscriptionId ||
          alignedSubscription?.externalSubscriptionId ||
          alignedSubscription?.paymentMethodId,
      ),
      paymentMethodBrand: alignedSubscription?.paymentMethodBrand ?? null,
      paymentMethodLastFour: alignedSubscription?.paymentMethodLastFour ?? null,
      cancelAtPeriodEnd: alignedSubscription?.cancelAtPeriodEnd ?? false,
      cancelledAt: alignedSubscription?.cancelledAt?.toISOString() ?? null,
      pausedAt: alignedSubscription?.pausedAt?.toISOString() ?? null,
      dunningNextRetryAt: alignedSubscription?.dunningNextRetryAt?.toISOString() ?? null,
      lastPaymentFailureReason: getBillingFailureMessage(
        alignedSubscription?.lastPaymentFailureReason,
      ),
      lastPaymentFailureCode: alignedSubscription?.lastPaymentFailureReason ?? null,
      billingHistory,
      needsPayment,
      trialEligible,
      billingContact: canManageBilling ? (tenantSettings?.settings.billing ?? {}) : {},
      ownerEmail: canManageBilling ? (tenant.createdBy?.email ?? null) : null,
      billingProvider: alignedSubscription?.billingProvider ?? this.providerForCountry(countryCode),
      supportsCardUpdate:
        !alignedSubscription || alignedSubscription.billingProvider === BillingProvider.NOMBA,
      pricingMismatch,
    };
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

    const billingEmail = await this.resolveBillingEmail(tenantId, tenant.createdBy?.email);
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
      billingEmail ?? user.email,
      metadata,
      this.resolveSuccessUrl(tenant.slug, successUrl),
      currency,
    );
    return { ...checkout, currency, billingProvider };
  }

  async cancelSubscription(tenantId: string, dto: CancelSubscriptionDto = {}) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException('Already cancelled');
    }
    const atPeriodEnd = dto.atPeriodEnd !== false;
    const reason = dto.reason?.trim() || null;
    if (
      isManagedSubscriptionProvider(subscription.billingProvider) &&
      subscription.externalSubscriptionId
    ) {
      await this.billingProviderFactory.cancelExternalSubscription(
        subscription.billingProvider,
        subscription.externalSubscriptionId,
        atPeriodEnd,
      );
    }
    if (atPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancellationReason = reason;
      subscription.pausedAt = null;
      if (subscription.status === SubscriptionStatus.PAUSED)
        subscription.status = SubscriptionStatus.ACTIVE;
    } else {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      subscription.cancelAtPeriodEnd = false;
      subscription.cancellationReason = reason;
      subscription.pausedAt = null;
    }
    return this.subscriptionRepo.save(subscription);
  }

  async resumeSubscription(tenantId: string) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (
      [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.INACTIVE,
      ].includes(subscription.status)
    ) {
      throw new BadRequestException('Cannot undo cancellation on this subscription');
    }
    if (!subscription.cancelAtPeriodEnd)
      throw new BadRequestException('No scheduled cancellation to undo');
    if (!subscription.paymentMethodId && !subscription.externalSubscriptionId)
      throw new BadRequestException('Add payment method first');
    if (new Date() >= subscription.currentPeriodEnd)
      throw new BadRequestException('Subscription period has ended');
    if (
      isManagedSubscriptionProvider(subscription.billingProvider) &&
      subscription.externalSubscriptionId
    ) {
      await this.billingProviderFactory.resumeExternalSubscription(
        subscription.billingProvider,
        subscription.externalSubscriptionId,
      );
    }
    if (subscription.status === SubscriptionStatus.PAUSED) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.pausedAt = null;
    }
    subscription.cancelAtPeriodEnd = false;
    subscription.cancellationReason = null;
    return this.subscriptionRepo.save(subscription);
  }

  async processDueRenewals(): Promise<RenewalJobResult> {
    return this.renewalProcessor.processDueRenewals();
  }
  async lapseStaleSubscriptions() {
    return this.renewalProcessor.lapseStaleSubscriptions();
  }
  async lapseStaleBachsSubscriptions() {
    return this.renewalProcessor.lapseStaleBachsSubscriptions();
  }
  async syncSubscriptionQuantity(tenantId: string) {
    return this.seatPricing.syncSubscriptionQuantity(tenantId);
  }

  async handleNombaWebhook(rawBody: string, signature: string) {
    return this.webhookDispatcher.handleNombaWebhook(rawBody, signature);
  }
  processNombaPayload(payload: unknown) {
    return this.webhookDispatcher.processNombaPayload(payload);
  }
  processBachsPayload(payload: unknown) {
    return this.webhookDispatcher.processBachsPayload(payload);
  }
  processPolarPayload(payload: unknown) {
    return this.webhookDispatcher.processPolarPayload(payload);
  }
  processMonnifyPayload(payload: unknown) {
    return this.webhookDispatcher.processMonnifyPayload(payload);
  }

  private toPlanQuote(price: PlanPrice, seatCount: number) {
    const breakdown = price.calculateMonthlyPrice(seatCount);
    const total = calculatePerSeatTotal(price, seatCount);
    return {
      planId: price.planId,
      planPriceId: price.id,
      slug: price.plan?.slug ?? '',
      name: price.plan?.name ?? '',
      description: price.plan?.description ?? null,
      currency: price.currency,
      seatCount,
      monthlyTotal: total,
      pricePerSeat: total / seatCount,
      breakdown,
      features: price.plan?.features ?? {},
      limits: price.plan?.limits ?? {},
    };
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

  private async resolveBillingEmail(
    tenantId: string,
    fallback?: string | null,
  ): Promise<string | null> {
    try {
      const s = await this.tenantSettingsService.getTenantSettings(tenantId);
      return s.settings.billing?.contactEmail?.trim() || fallback?.trim() || null;
    } catch {
      return fallback?.trim() || null;
    }
  }
}
