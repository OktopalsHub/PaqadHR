import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isNoahPaymentVerified } from 'src/common/config/noah-api.util';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import {
  isAllowedTenantFrontendOrigin,
  isSubdomainTenantsEnabled,
  tenantFrontendUrl,
} from 'src/common/utils/tenant-frontend-url.util';
import {
  Brackets,
  DataSource,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import {
  BillingChargeType,
  CARD_UPDATE_VERIFY_AMOUNT,
  PENDING_SEAT_CHARGE_TTL_HOURS,
  RENEWAL_GRACE_PERIOD_DAYS,
  RENEWAL_PENDING_CLAIM_TTL_MS,
} from '../constants/billing.constants';
import { BillingProvider, isManagedSubscriptionProvider } from '../constants/billing-provider.enum';
import type { CancelSubscriptionDto } from '../dto/cancel-subscription.dto';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type {
  SubscriptionBillingMetadata,
  SubscriptionWebhookEvent,
  SubscriptionWebhookPayment,
} from '../interfaces/subscription-billing.interface';
import { computeDunningNextRetryAt, maxDunningAttempts } from '../utils/dunning.util';
import {
  getBillingFailureMessage,
  mapNombaBillingFailure,
} from '../utils/nomba-billing-failure.util';
import {
  calculatePerSeatTotal,
  calculateProratedSeatCharge,
  isAmountWithinTolerance,
  normalizeWebhookAmount,
  resolveSeatCount,
} from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { NombaApiService } from './nomba-api.service';
import { SubscriptionsService } from './subscriptions.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RenewalJobResult {
  charged: number;
  failed: number;
  skipped: number;
  suspended: number;
}

@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly nombaApi: NombaApiService,
    private readonly monnifyApi: MonnifyApiService,
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
    @InjectRepository(BillingEvent)
    private readonly billingEventRepository: Repository<BillingEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly productAnalytics: ProductAnalyticsService,
    @Optional() private readonly notificationHelper?: NotificationHelperService,
  ) {}

  private providerForCountry(countryCode: string | null | undefined): BillingProvider {
    return this.billingProviderFactory.resolveBillingProvider(countryCode);
  }

  private async verifyPaymentReference(reference: string, provider: BillingProvider) {
    if (provider === BillingProvider.MONNIFY) {
      const verified = await this.monnifyApi.verifyTransaction(reference);
      return verified
        ? { status: verified.paid ? 'success' : 'pending', amount: verified.amount }
        : { status: 'pending', amount: 0 };
    }
    if (provider !== BillingProvider.NOMBA) {
      return { status: 'success', amount: 0 };
    }
    return this.nombaApi.verifyTransaction(reference);
  }

  private requiresProviderVerification(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA || provider === BillingProvider.MONNIFY;
  }

  private requiresCardToken(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA;
  }

  private resolveWebhookTenantId(event: SubscriptionWebhookEvent): string | null {
    if (event.kind === 'subscription.created' || event.kind === 'subscription.cancelled') {
      return event.tenantId;
    }
    if (event.kind === 'payment.success' || event.kind === 'payment.failed') {
      return event.payment.tenantId;
    }
    return null;
  }

  private isTrialInitialCheckoutWebhook(
    event: SubscriptionWebhookEvent,
    subscription: TenantSubscription,
  ): boolean {
    return (
      subscription.status === SubscriptionStatus.TRIAL &&
      event.kind === 'payment.success' &&
      event.payment.billingType === BillingChargeType.SUBSCRIPTION
    );
  }

  private isStaleProviderWebhook(
    event: SubscriptionWebhookEvent,
    subscription: TenantSubscription | null,
    webhookProvider: BillingProvider,
  ): boolean {
    if (!subscription?.billingProvider) {
      return false;
    }
    if (subscription.billingProvider === webhookProvider) {
      return false;
    }
    // During trial, allow only the initial subscription checkout webhook from the provider
    // taking over. Follow-up webhooks like card updates must still come from the active provider.
    if (this.isTrialInitialCheckoutWebhook(event, subscription)) {
      return false;
    }
    return true;
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

  private async processBillingPayload(
    payload: unknown,
    provider: BillingProvider,
  ): Promise<{ received: boolean }> {
    const billingProvider = this.billingProviderFactory.getProviderByEnum(provider);
    const event = billingProvider.parseWebhook(payload);
    if (!event || event.kind === 'ignored') {
      return { received: true };
    }

    let subscription = await this.resolveWebhookSubscription(event);
    if ((event.kind === 'payment.success' || event.kind === 'payment.failed') && subscription) {
      this.enrichPaymentFromSubscription(event.payment, subscription);
    }

    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID_PATTERN.test(tenantId) && !subscription) {
      subscription = await this.subscriptionRepository.findOne({ where: { tenantId } });
    }
    if (tenantId && UUID_PATTERN.test(tenantId)) {
      if (this.isStaleProviderWebhook(event, subscription, provider)) {
        this.logger.warn(
          `Ignoring ${event.kind} webhook from ${provider} for tenant ${tenantId}; active provider is ${subscription?.billingProvider}`,
        );
        return { received: true };
      }
    }

    if (event.kind === 'payment.success') {
      let billingType = event.payment.billingType;
      // Bachs/Polar bill via provider subscriptions (webhooks only — no app cron charges).
      // Cycle invoices omit checkout metadata; route those to renewal handling once the
      // tenant already has paid billing history and the current period is due.
      const hasPaidBillingHistory = (subscription?.billingHistory?.length ?? 0) > 0;
      if (
        billingType === BillingChargeType.SUBSCRIPTION &&
        subscription?.status === SubscriptionStatus.ACTIVE &&
        subscription.externalSubscriptionId?.trim() &&
        isManagedSubscriptionProvider(provider) &&
        hasPaidBillingHistory &&
        subscription.nextBillingDate <= new Date()
      ) {
        billingType = BillingChargeType.SUBSCRIPTION_RENEWAL;
      }
      if (billingType === BillingChargeType.SUBSCRIPTION_RENEWAL) {
        await this.processRenewalPaymentSuccess(event.payment, provider);
      } else if (billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE) {
        await this.processQuantityUpdatePaymentSuccess(event.payment, provider);
      } else if (billingType === BillingChargeType.CARD_UPDATE) {
        await this.processCardUpdateSuccess(event.payment, provider);
      } else {
        await this.processInitialPaymentSuccess(event.payment, provider);
      }
    }

    if (event.kind === 'payment.failed') {
      await this.processPaymentFailed(event.payment, provider);
    }

    if (event.kind === 'subscription.created') {
      await this.processExternalSubscriptionCreated(event, provider);
    }

    if (event.kind === 'subscription.cancelled') {
      await this.processExternalSubscriptionCancelled(event, provider);
    }

    return { received: true };
  }

  private async resolveWebhookSubscription(
    event: SubscriptionWebhookEvent,
  ): Promise<TenantSubscription | null> {
    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID_PATTERN.test(tenantId)) {
      return this.subscriptionRepository.findOne({ where: { tenantId } });
    }

    const externalSubscriptionId =
      event.kind === 'payment.success' || event.kind === 'payment.failed'
        ? event.payment.externalSubscriptionId?.trim()
        : event.kind === 'subscription.created' || event.kind === 'subscription.cancelled'
          ? event.externalSubscriptionId?.trim()
          : undefined;
    if (!externalSubscriptionId) {
      return null;
    }

    return this.subscriptionRepository.findOne({
      where: { externalSubscriptionId },
    });
  }

  private enrichPaymentFromSubscription(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
  ): void {
    if (!payment.tenantId?.trim() || !UUID_PATTERN.test(payment.tenantId)) {
      payment.tenantId = subscription.tenantId;
    }
    if (!payment.planId?.trim()) {
      payment.planId = subscription.planId;
    }
    if (!payment.planPriceId?.trim()) {
      payment.planPriceId = subscription.planPriceId;
    }
    if (payment.quantity == null && subscription.currentUsers != null) {
      payment.quantity = subscription.currentUsers;
    }
    if (!payment.externalSubscriptionId?.trim() && subscription.externalSubscriptionId) {
      payment.externalSubscriptionId = subscription.externalSubscriptionId;
    }
  }

  private async processExternalSubscriptionCreated(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.created' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: event.tenantId },
    });
    if (!subscription) {
      return;
    }
    if (
      subscription.billingProvider !== provider &&
      subscription.status !== SubscriptionStatus.TRIAL &&
      subscription.externalSubscriptionId?.trim()
    ) {
      return;
    }

    subscription.externalSubscriptionId = event.externalSubscriptionId;
    subscription.billingProvider = provider;
    subscription.paymentMethodId = subscription.paymentMethodId ?? event.externalSubscriptionId;

    if (event.planPriceId && event.planId) {
      const planPrice = await this.plansService.getPlanPriceById(event.planPriceId);
      if (planPrice?.isActive && planPrice.planId === event.planId) {
        subscription.planId = planPrice.planId;
        subscription.planPriceId = planPrice.id;
      }
    }

    if (event.quantity != null && Number.isFinite(event.quantity)) {
      subscription.currentUsers = resolveSeatCount(event.quantity);
    }

    const providerStatus = event.providerStatus?.toLowerCase();
    const hasPlanMetadata = !!event.planId && !!event.planPriceId;
    // Checkout with plan metadata = customer subscribed (card on file). Do not map
    // provider "trialing" to our free-app TRIAL — that made Scale look unpaid.
    if (hasPlanMetadata) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.trialEndsAt = null;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = null;
    } else if (providerStatus === 'trialing' || providerStatus === 'trial') {
      subscription.status = SubscriptionStatus.TRIAL;
      if (event.trialEndsAt) {
        const trialEnd = new Date(event.trialEndsAt);
        if (!Number.isNaN(trialEnd.getTime())) {
          subscription.trialEndsAt = trialEnd;
        }
      }
    } else if (providerStatus === 'active' || providerStatus === 'paid') {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.trialEndsAt = null;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = null;
    }

    if (event.currentPeriodStart) {
      const start = new Date(event.currentPeriodStart);
      if (!Number.isNaN(start.getTime())) {
        subscription.currentPeriodStart = start;
        // For a paid subscription that the provider reports as trialing,
        // the provider's period dates reflect the trial boundary (e.g.
        // 14 days), not the actual subscription period. Recalculate
        // currentPeriodEnd as start + 1 month so the active window is
        // monthly, not the trial length.
        if (hasPlanMetadata && providerStatus === 'trialing') {
          const correctEnd = new Date(start);
          correctEnd.setMonth(correctEnd.getMonth() + 1);
          subscription.currentPeriodEnd = correctEnd;
          subscription.nextBillingDate = correctEnd;
        }
      }
    }
    if (event.currentPeriodEnd && !(hasPlanMetadata && providerStatus === 'trialing')) {
      const end = new Date(event.currentPeriodEnd);
      if (!Number.isNaN(end.getTime())) subscription.currentPeriodEnd = end;
    }
    if (event.nextBillingDate && !(hasPlanMetadata && providerStatus === 'trialing')) {
      const next = new Date(event.nextBillingDate);
      if (!Number.isNaN(next.getTime())) subscription.nextBillingDate = next;
    } else if (!hasPlanMetadata && event.trialEndsAt) {
      const trialEnd = new Date(event.trialEndsAt);
      if (!Number.isNaN(trialEnd.getTime())) subscription.nextBillingDate = trialEnd;
    }

    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_created',
      {
        tenantId: event.tenantId,
        externalSubscriptionId: event.externalSubscriptionId,
        planId: event.planId,
        planPriceId: event.planPriceId,
        providerStatus: event.providerStatus,
      },
      provider,
    );

    if (hasPlanMetadata && subscription.status === SubscriptionStatus.ACTIVE) {
      this.productAnalytics.capture('system', 'subscription_activated', {
        tenantId: event.tenantId,
      });
    }

    // Bachs catalog trial must not survive a paid Paqad checkout — end it so Bachs shows active.
    if (
      hasPlanMetadata &&
      (providerStatus === 'trialing' || providerStatus === 'trial') &&
      event.externalSubscriptionId
    ) {
      await this.endProviderTrialBestEffort(provider, event.externalSubscriptionId, event.tenantId);
    }
  }

  private async endProviderTrialBestEffort(
    provider: BillingProvider,
    externalSubscriptionId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      await this.billingProviderFactory.endExternalTrial(provider, externalSubscriptionId);
      this.logger.log(
        `Ended ${provider} trial on ${externalSubscriptionId} for tenant ${tenantId} after paid checkout`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not end ${provider} trial on ${externalSubscriptionId} for tenant ${tenantId}: ${message}`,
      );
    }
  }

  private async processExternalSubscriptionCancelled(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.cancelled' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) {
      return;
    }

    let subscription: TenantSubscription | null = null;
    if (event.tenantId && UUID_PATTERN.test(event.tenantId)) {
      subscription = await this.subscriptionRepository.findOne({
        where: { tenantId: event.tenantId },
      });
    }
    if (!subscription && event.externalSubscriptionId?.trim()) {
      subscription = await this.subscriptionRepository.findOne({
        where: { externalSubscriptionId: event.externalSubscriptionId.trim() },
      });
    }
    if (!subscription || subscription.billingProvider !== provider) {
      return;
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancelAtPeriodEnd = false;
    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_cancelled',
      {
        tenantId: subscription.tenantId,
        externalSubscriptionId: event.externalSubscriptionId,
      },
      provider,
    );
  }

  async getTenantSeatCount(tenantId: string): Promise<number> {
    const count = await this.tenantMemberRepository.count({
      where: { tenantId, isActive: true },
    });
    return resolveSeatCount(count);
  }

  async getBillingOverview(tenantId: string, canManageBilling: boolean, userId?: string | null) {
    const [tenant, billingStatus, seatCount, rawSubscription, tenantSettings] = await Promise.all([
      this.tenantRepository.findOne({ where: { id: tenantId }, relations: ['createdBy'] }),
      this.subscriptionsService.getBillingStatus(tenantId),
      this.getTenantSeatCount(tenantId),
      this.subscriptionsService.getTenantSubscription(tenantId),
      this.tenantSettingsService.getTenantSettings(tenantId).catch(() => null),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const subscription = rawSubscription
      ? await this.healBachsTrialingPaidSubscription(rawSubscription)
      : null;

    const { subscription: alignedSubscription, pricingMismatch } =
      await this.subscriptionsService.healNgSubscriptionPlanPrice(tenant.countryCode, subscription);

    const { countryCode, currency } = GeoLocationHelper.resolveEffectiveCountryAndCurrency(
      tenant.countryCode,
      tenant.preferredCurrency,
    );
    const planPrices = await this.plansService.getPricesForCountry(countryCode);
    const _paymentsEnabled = isBillingGatewayEnabled();

    const plans = planPrices
      .filter((price) => price.plan?.isActive)
      .map((price) => this.toPlanQuote(price, seatCount))
      .sort((a, b) => a.name.localeCompare(b.name));

    const sub = billingStatus.subscription;
    const needsPayment = this.subscriptionsService.computeNeedsPayment(sub);
    const trialEligible = await this.subscriptionsService.isTrialEligible(userId, tenantId);

    const billingHistory = (alignedSubscription?.billingHistory ?? [])
      .filter((entry) => !(entry.status === 'paid' && Number(entry.amount) === 0))
      .map((entry) => ({
        date: entry.date instanceof Date ? entry.date.toISOString() : String(entry.date),
        amount: entry.amount,
        currency: entry.currency,
        status: entry.status,
        invoiceId: entry.invoiceId ?? null,
        failureReason: entry.failureReason ?? null,
      }));

    return {
      ...billingStatus,
      seatCount,
      countryCode,
      currency: plans[0]?.currency ?? currency,
      canManageBilling: canManageBilling,
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

    await this.subscriptionsService.resolveAndLockTenantRegion(tenantId, {
      clientIp,
      headers,
      userId,
    });
    const lockedTenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
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

    this.productAnalytics.capture(userId, 'subscription_checkout_started', {
      userId,
      tenantId,
      plan: normalizedSlug,
    });

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

  async cancelSubscription(tenantId: string, dto: CancelSubscriptionDto = {}) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    const atPeriodEnd = dto.atPeriodEnd !== false;
    const reason = dto.reason?.trim() || null;

    if (
      isManagedSubscriptionProvider(subscription.billingProvider) &&
      subscription.externalSubscriptionId
    ) {
      await this.cancelManagedExternalSubscription(subscription, atPeriodEnd);
    }

    if (atPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancellationReason = reason;
      subscription.pausedAt = null;
      if (subscription.status === SubscriptionStatus.PAUSED) {
        subscription.status = SubscriptionStatus.ACTIVE;
      }
    } else {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      subscription.cancelAtPeriodEnd = false;
      subscription.cancellationReason = reason;
      subscription.pausedAt = null;
    }

    const saved = await this.subscriptionRepository.save(subscription);
    this.productAnalytics.capture('system', 'subscription_cancelled', { tenantId });
    return saved;
  }

  /** Undo a scheduled cancellation (`cancelAtPeriodEnd`). Pause is not supported. */
  async resumeSubscription(tenantId: string) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED ||
      subscription.status === SubscriptionStatus.SUSPENDED ||
      subscription.status === SubscriptionStatus.INACTIVE
    ) {
      throw new BadRequestException(
        'Cannot undo cancellation on a cancelled, expired, or inactive subscription',
      );
    }
    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('No scheduled cancellation to undo');
    }
    if (!subscription.paymentMethodId && !subscription.externalSubscriptionId) {
      throw new BadRequestException('Add a payment method before undoing cancellation');
    }
    if (new Date() >= subscription.currentPeriodEnd) {
      throw new BadRequestException('Subscription period has ended');
    }

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
    return this.subscriptionRepository.save(subscription);
  }

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (
      !this.billingProviderFactory.getNombaProvider().verifyWebhookSignature(rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    return this.processNombaPayload(payload);
  }

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    return this.processBillingPayload(payload, BillingProvider.NOMBA);
  }

  async processBachsPayload(payload: unknown): Promise<{ received: boolean }> {
    return this.processBillingPayload(payload, BillingProvider.BACHS);
  }

  async processPolarPayload(payload: unknown): Promise<{ received: boolean }> {
    return this.processBillingPayload(payload, BillingProvider.POLAR);
  }

  async processMonnifyPayload(payload: unknown): Promise<{ received: boolean }> {
    return this.processBillingPayload(payload, BillingProvider.MONNIFY);
  }

  async syncSubscriptionQuantity(tenantId: string): Promise<void> {
    if (!isBillingGatewayEnabled()) return;

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId },
      relations: ['planPrice', 'tenant', 'tenant.createdBy'],
    });
    if (
      !subscription ||
      subscription.status !== SubscriptionStatus.ACTIVE ||
      subscription.billingProvider !== BillingProvider.NOMBA ||
      !subscription.nombaSubscriptionId ||
      !subscription.paymentMethodId
    ) {
      return;
    }

    const liveSeats = await this.getTenantSeatCount(tenantId);
    const billedSeats = subscription.currentUsers;
    const pendingSeatCount = subscription.usageMetrics?.pendingSeatCount;

    if (pendingSeatCount != null) {
      const pendingStale = this.isPendingSeatChargeStale(subscription);
      const seatsDecreased = liveSeats < billedSeats;
      const pendingTargetDrifted = liveSeats !== pendingSeatCount;

      if (!pendingStale && !seatsDecreased && !pendingTargetDrifted) {
        return;
      }

      this.logger.warn(
        `Clearing stuck/stale pending seat charge for tenant ${tenantId} (stale=${pendingStale}, decreased=${seatsDecreased}, drifted=${pendingTargetDrifted})`,
      );
      subscription.usageMetrics = {
        ...(subscription.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      if (seatsDecreased) {
        subscription.currentUsers = liveSeats;
        await this.subscriptionRepository.save(subscription);
        return;
      }
      await this.subscriptionRepository.save(subscription);
    }

    if (liveSeats === billedSeats) {
      return;
    }

    if (liveSeats < billedSeats) {
      subscription.currentUsers = liveSeats;
      subscription.usageMetrics = {
        ...(subscription.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      await this.subscriptionRepository.save(subscription);
      return;
    }

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice) {
      this.logger.warn(`Plan price ${subscription.planPriceId} not found for tenant ${tenantId}`);
      return;
    }

    const billingEmail = await this.resolveBillingEmail(
      tenantId,
      subscription.tenant?.createdBy?.email,
    );
    if (!billingEmail) {
      this.logger.warn(`No billing contact email found for tenant ${tenantId}`);
      return;
    }

    const extraSeats = liveSeats - billedSeats;
    const { amount } = calculateProratedSeatCharge(
      planPrice,
      extraSeats,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );

    if (amount <= 0) {
      subscription.currentUsers = liveSeats;
      await this.subscriptionRepository.save(subscription);
      return;
    }

    await this.billingProviderFactory
      .getNombaProvider()
      .chargeSeatAddition(
        subscription.nombaSubscriptionId,
        planPrice,
        amount,
        liveSeats,
        extraSeats,
        subscription.paymentMethodId,
        billingEmail,
        {
          tenantId,
          planId: subscription.planId,
          planPriceId: subscription.planPriceId,
          quantity: liveSeats,
          targetSeatCount: liveSeats,
          extraSeats,
          billingType: BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE,
        },
      );

    subscription.usageMetrics = {
      ...(subscription.usageMetrics ?? {}),
      pendingSeatCount: liveSeats,
      pendingExtraSeats: extraSeats,
      pendingChargeAmount: amount,
      pendingSeatChargedAt: new Date().toISOString(),
    };
    await this.subscriptionRepository.save(subscription);
  }

  /** Clear stale seat-addition locks and retry quantity sync during the daily renewal pass. */
  async reclaimStuckPendingSeatCharges(): Promise<number> {
    if (!isBillingGatewayEnabled()) {
      return 0;
    }

    const stuck = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .where('sub.status = :active', { active: SubscriptionStatus.ACTIVE })
      .andWhere('sub.billing_provider = :nomba', { nomba: BillingProvider.NOMBA })
      .andWhere(`sub.usage_metrics ? 'pendingSeatCount'`)
      .getMany();

    let reclaimed = 0;
    for (const subscription of stuck) {
      if (!this.isPendingSeatChargeStale(subscription)) {
        continue;
      }
      await this.syncSubscriptionQuantity(subscription.tenantId);
      reclaimed += 1;
    }
    return reclaimed;
  }

  private isPendingSeatChargeStale(subscription: TenantSubscription, now = new Date()): boolean {
    if (subscription.usageMetrics?.pendingSeatCount == null) {
      return false;
    }
    const chargedAtRaw = subscription.usageMetrics.pendingSeatChargedAt;
    if (!chargedAtRaw) {
      // Legacy rows without a timestamp are treated as stuck and cleared.
      return true;
    }
    const chargedAt = new Date(chargedAtRaw);
    if (Number.isNaN(chargedAt.getTime())) {
      return true;
    }
    const ageMs = now.getTime() - chargedAt.getTime();
    return ageMs >= PENDING_SEAT_CHARGE_TTL_HOURS * 60 * 60 * 1000;
  }

  async processDueRenewals(): Promise<RenewalJobResult> {
    const result: RenewalJobResult = { charged: 0, failed: 0, skipped: 0, suspended: 0 };
    if (!isBillingGatewayEnabled()) {
      return result;
    }

    const now = new Date();
    await this.reclaimStuckPendingSeatCharges();
    result.suspended = await this.suspendPastGraceSubscriptions(now);
    await this.finalizeScheduledCancellations(now);

    const dueSubscriptions = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.planPrice', 'planPrice')
      .leftJoinAndSelect('sub.tenant', 'tenant')
      .leftJoinAndSelect('tenant.createdBy', 'createdBy')
      .where('sub.payment_method_id IS NOT NULL')
      .andWhere('sub.billing_provider = :nomba', { nomba: BillingProvider.NOMBA })
      .andWhere('sub.nomba_subscription_id IS NOT NULL')
      .andWhere('sub.status NOT IN (:...excluded)', {
        excluded: [SubscriptionStatus.CANCELLED, SubscriptionStatus.PAUSED],
      })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            new Brackets((inner) => {
              inner
                .where('sub.status = :active', { active: SubscriptionStatus.ACTIVE })
                .andWhere('sub.next_billing_date <= :now', { now })
                .andWhere('sub.cancel_at_period_end = false');
            }),
          ).orWhere(
            new Brackets((inner) => {
              inner
                .where('sub.status = :pastDue', { pastDue: SubscriptionStatus.PAST_DUE })
                .andWhere('sub.dunning_next_retry_at <= :now', { now })
                .andWhere('sub.dunning_attempt_count < :maxAttempts', {
                  maxAttempts: maxDunningAttempts(),
                });
            }),
          );
        }),
      )
      .getMany();

    for (const subscription of dueSubscriptions) {
      const outcome = await this.chargeSubscriptionRenewal(subscription);
      if (outcome === 'charged') result.charged += 1;
      else if (outcome === 'failed') result.failed += 1;
      else result.skipped += 1;
    }

    return result;
  }

  private async chargeSubscriptionRenewal(
    subscription: TenantSubscription,
  ): Promise<'charged' | 'failed' | 'skipped'> {
    const attemptCount = subscription.dunningAttemptCount ?? 0;
    const billingProviderEnum =
      subscription.billingProvider ?? this.providerForCountry(subscription.tenant?.countryCode);
    const periodEventId = this.renewalPeriodEventId(subscription.id, subscription.nextBillingDate);

    if (isManagedSubscriptionProvider(billingProviderEnum)) {
      return 'skipped';
    }

    if (subscription.nextBillingDate > new Date()) {
      return 'skipped';
    }

    const healed = await this.healRenewalFromExistingPeriodCharge(
      subscription,
      periodEventId,
      billingProviderEnum,
      attemptCount,
    );
    if (healed === 'charged') {
      return 'charged';
    }
    if (healed === 'skip') {
      return 'skipped';
    }

    const claim = await this.claimRenewalPeriodCharge(
      subscription.id,
      periodEventId,
      subscription.tenantId,
      billingProviderEnum,
    );
    if (claim === 'skip') {
      return 'skipped';
    }

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice?.isActive) {
      this.logger.warn(`Skipping renewal for ${subscription.tenantId}: inactive plan price`);
      return 'skipped';
    }

    const billingEmail = await this.resolveBillingEmail(
      subscription.tenantId,
      subscription.tenant?.createdBy?.email,
    );
    const tokenKey = subscription.paymentMethodId;
    const nombaReference = subscription.nombaSubscriptionId;
    if (!billingEmail || !tokenKey || !nombaReference) {
      this.logger.warn(
        `Skipping renewal for ${subscription.tenantId}: missing billing credentials`,
      );
      return 'skipped';
    }

    const seatCount = await this.getTenantSeatCount(subscription.tenantId);
    const orderReference = this.buildNombaRenewalOrderReference(
      subscription.id,
      subscription.nextBillingDate,
    );
    const metadata: SubscriptionBillingMetadata = {
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      planPriceId: subscription.planPriceId,
      quantity: seatCount,
      orderReference,
    };

    // Persist reference before calling Nomba so a crash mid-charge can heal without re-charging.
    await this.updateRenewalPeriodClaim(
      periodEventId,
      { status: 'pending', orderReference, claimedAt: new Date().toISOString() },
      billingProviderEnum,
    );

    try {
      const billingProvider = this.billingProviderFactory.getProviderByEnum(billingProviderEnum);
      const charge = await billingProvider.chargeRenewal(
        nombaReference,
        planPrice,
        seatCount,
        tokenKey,
        billingEmail,
        metadata,
      );

      await this.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'charged', orderReference: charge.orderReference || orderReference },
        billingProviderEnum,
      );

      const verified = await this.verifyPaymentReference(
        charge.orderReference,
        billingProviderEnum,
      );
      if (
        !verified ||
        (this.requiresProviderVerification(billingProviderEnum) &&
          !isNoahPaymentVerified(verified.status))
      ) {
        await this.updateRenewalPeriodClaim(
          periodEventId,
          {
            status: 'failed',
            orderReference: charge.orderReference,
            failed: true,
            attemptCount,
          },
          billingProviderEnum,
        );
        await this.markRenewalFailed(subscription, charge.orderReference, 'verification_failed');
        return 'failed';
      }

      const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
      const normalizedPaid = normalizeWebhookAmount(
        Number(verified.amount ?? 0),
        expectedAmount,
        planPrice.currency,
      );

      await this.applyRenewalSuccess(
        subscription.tenantId,
        {
          eventId: charge.orderReference,
          reference: charge.orderReference,
          tenantId: subscription.tenantId,
          planId: subscription.planId,
          planPriceId: subscription.planPriceId,
          quantity: seatCount,
          amount: normalizedPaid,
          currency: planPrice.currency.toUpperCase(),
          tokenKey,
          status: 'success',
          billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
        },
        billingProviderEnum,
        subscription.nextBillingDate,
        attemptCount,
      );

      await this.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'success', orderReference: charge.orderReference },
        billingProviderEnum,
      );

      return 'charged';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Renewal charge failed for tenant ${subscription.tenantId}: ${message}`);
      await this.updateRenewalPeriodClaim(
        periodEventId,
        { status: 'failed', failed: true, attemptCount, detail: message },
        billingProviderEnum,
      );
      await this.markRenewalFailed(subscription, periodEventId, message);
      return 'failed';
    }
  }

  /** Pull remote Polar/Bachs state for subscriptions not updated in 24h. */
  async reconcileStaleManagedSubscriptions(): Promise<{ synced: number; failed: number }> {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 24);

    const stale = await this.subscriptionRepository.find({
      where: {
        billingProvider: In([BillingProvider.POLAR, BillingProvider.BACHS]),
        externalSubscriptionId: Not(IsNull()),
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIAL,
          SubscriptionStatus.PAST_DUE,
        ]),
        updatedAt: LessThan(staleDate),
      },
    });

    let synced = 0;
    let failed = 0;

    for (const subscription of stale) {
      try {
        await this.syncExternalSubscription(subscription);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to sync ${subscription.billingProvider} subscription ${subscription.id}: ${message}`,
        );
      }
    }

    return { synced, failed };
  }

  /**
   * Bachs/Polar renewals are webhook-only; Monnify requires manual checkout.
   * After a 3-day grace past nextBillingDate with no renewal, mark PAST_DUE
   * so entitlements stop instead of staying ACTIVE forever.
   */
  async lapseStaleSubscriptions(): Promise<{ lapsed: number }> {
    const graceMs = 3 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - graceMs);

    const stale = await this.subscriptionRepository.find({
      where: {
        billingProvider: In([
          BillingProvider.BACHS,
          BillingProvider.POLAR,
          BillingProvider.MONNIFY,
        ]),
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: LessThanOrEqual(cutoff),
      },
    });

    let lapsed = 0;
    for (const subscription of stale) {
      // Managed providers must have an external id; Monnify is checkout-only.
      if (
        isManagedSubscriptionProvider(subscription.billingProvider) &&
        !subscription.externalSubscriptionId
      ) {
        continue;
      }
      subscription.status = SubscriptionStatus.PAST_DUE;
      await this.subscriptionRepository.save(subscription);
      lapsed += 1;
      this.logger.warn(
        `Lapsed stale ${subscription.billingProvider} subscription ${subscription.id} for tenant ${subscription.tenantId}`,
      );
    }

    return { lapsed };
  }

  /** @deprecated Prefer lapseStaleSubscriptions — kept for callers/tests. */
  async lapseStaleBachsSubscriptions(): Promise<{ lapsed: number }> {
    return this.lapseStaleSubscriptions();
  }

  async syncExternalSubscription(subscription: TenantSubscription): Promise<TenantSubscription> {
    if (
      !isManagedSubscriptionProvider(subscription.billingProvider) ||
      !subscription.externalSubscriptionId
    ) {
      return subscription;
    }

    const provider = this.billingProviderFactory.getProviderByEnum(subscription.billingProvider);
    let remote = (await provider.getSubscription(subscription.externalSubscriptionId)) as Record<
      string,
      unknown
    >;

    let remoteStatus = String(remote.status ?? '').toLowerCase();

    // Paid Paqad checkout must not stay `trialing` on Bachs (catalog trial_period).
    // End the trial so Bachs next_billed_at matches a real billing cycle, not trial end.
    if (
      subscription.billingProvider === BillingProvider.BACHS &&
      (remoteStatus === 'trialing' || remoteStatus === 'trial') &&
      this.hasPaidSubscriptionEvidence(subscription)
    ) {
      await this.endProviderTrialBestEffort(
        BillingProvider.BACHS,
        subscription.externalSubscriptionId,
        subscription.tenantId,
      );
      remote = (await provider.getSubscription(subscription.externalSubscriptionId)) as Record<
        string,
        unknown
      >;
      remoteStatus = String(remote.status ?? '').toLowerCase();
    }

    const priorPeriodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

    const remoteIsTrialing = remoteStatus === 'trialing' || remoteStatus === 'trial';
    const preservePaidLocalPeriod =
      remoteIsTrialing && this.hasPaidSubscriptionEvidence(subscription);

    if (remoteIsTrialing) {
      // Genuine provider trial (should be rare) — do not clobber a local ACTIVE paid period.
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        subscription.status = SubscriptionStatus.TRIAL;
      }
    } else if (remoteStatus) {
      subscription.status = provider.mapStatus(remoteStatus);
    }

    const cancelAtPeriodEnd = remote.cancel_at_period_end;
    if (typeof cancelAtPeriodEnd === 'boolean') {
      subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    // Never replace a paid cycle with Bachs catalog-trial dates (e.g. Aug 26 vs Sept 12).
    const periodEnd = preservePaidLocalPeriod
      ? null
      : this.parseRemoteDate(
          remote.current_period_end ?? remote.currentPeriodEnd ?? remote.ends_at,
        );
    if (periodEnd) {
      subscription.currentPeriodEnd = periodEnd;
    }

    if (!preservePaidLocalPeriod) {
      const nextBilling = this.parseRemoteDate(
        remote.next_billed_at ?? remote.nextBillingDate ?? remote.current_period_end,
      );
      if (nextBilling) {
        subscription.nextBillingDate = nextBilling;
      }
    }

    if (remoteStatus === 'canceled' || remoteStatus === 'cancelled' || remoteStatus === 'revoked') {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = subscription.cancelledAt ?? new Date();
    }

    if (
      periodEnd &&
      priorPeriodEnd &&
      periodEnd.getTime() > priorPeriodEnd.getTime() &&
      subscription.status === SubscriptionStatus.ACTIVE
    ) {
      const syncRef = `sync_${subscription.externalSubscriptionId}_${periodEnd.toISOString()}`;
      if (!(await this.hasProcessedEvent(syncRef, subscription.billingProvider))) {
        // Period advanced via provider sync; record event for audit but do NOT
        // fabricate a $0 invoice in billingHistory. Real invoices must come from
        // payment webhooks (applyRenewalSuccess/processInitialPaymentSuccess) or
        // renewal cron which carry the actual amount.
        await this.recordBillingEvent(
          syncRef,
          'subscription_period_synced',
          {
            tenantId: subscription.tenantId,
            externalSubscriptionId: subscription.externalSubscriptionId,
            periodEnd: periodEnd.toISOString(),
          },
          subscription.billingProvider,
        );
      }
    }

    return this.subscriptionRepository.save(subscription);
  }

  private hasPaidSubscriptionEvidence(subscription: TenantSubscription): boolean {
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return true;
    }
    return (subscription.billingHistory ?? []).some(
      (entry) => entry.status === 'paid' && Number(entry.amount) > 0,
    );
  }

  /** When Bachs still shows trialing after a paid checkout, end trial and refresh dates. */
  private async healBachsTrialingPaidSubscription(
    subscription: TenantSubscription,
  ): Promise<TenantSubscription> {
    if (
      subscription.billingProvider !== BillingProvider.BACHS ||
      !subscription.externalSubscriptionId ||
      !this.hasPaidSubscriptionEvidence(subscription)
    ) {
      return subscription;
    }

    try {
      return await this.syncExternalSubscription(subscription);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Bachs trial heal skipped for tenant ${subscription.tenantId}: ${message}`);
      return subscription;
    }
  }

  private parseRemoteDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async finalizeScheduledCancellations(now: Date): Promise<void> {
    await this.subscriptionRepository
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: now,
        cancelAtPeriodEnd: false,
      })
      .where('cancel_at_period_end = true')
      .andWhere('current_period_end <= :now', { now })
      .andWhere('status = :status', { status: SubscriptionStatus.ACTIVE })
      .execute();
  }

  private async suspendPastGraceSubscriptions(now: Date): Promise<number> {
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - RENEWAL_GRACE_PERIOD_DAYS);

    const toSuspend = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        nextBillingDate: LessThan(graceCutoff),
      },
      relations: ['tenant', 'tenant.createdBy'],
    });

    const update = await this.subscriptionRepository
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ status: SubscriptionStatus.SUSPENDED })
      .where('status = :status', { status: SubscriptionStatus.PAST_DUE })
      .andWhere('next_billing_date < :graceCutoff', { graceCutoff })
      .execute();

    for (const subscription of toSuspend) {
      await this.notifyRenewalIssue(
        subscription,
        'SUSPENDED',
        'Renewal grace period expired. Subscription suspended.',
      );
    }

    return update.affected ?? 0;
  }

  private async notifyRenewalIssue(
    subscription: TenantSubscription,
    status: string,
    reason: string,
  ): Promise<void> {
    const ownerId = subscription.tenant?.createdBy?.id;
    if (!ownerId || !this.notificationHelper) {
      return;
    }

    // Notifications are tenant-scoped (keyed by member id), so map the owner's
    // user id to their tenant-member id before notifying.
    const ownerMember = await this.tenantMemberRepository.findOne({
      where: { userId: ownerId, tenantId: subscription.tenantId },
      select: ['id'],
    });
    if (!ownerMember) {
      return;
    }

    await this.notificationHelper.sendBillingRenewalFailedNotification(
      ownerMember.id,
      subscription.tenantId,
      {
        tenantName: subscription.tenant?.name ?? 'your workspace',
        reason,
        status,
      },
    );
  }

  private async markRenewalFailed(
    subscription: TenantSubscription,
    reference: string,
    reason: string,
  ): Promise<void> {
    const mapped = mapNombaBillingFailure(reason);
    const nextCount = (subscription.dunningAttemptCount ?? 0) + 1;

    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.dunningAttemptCount = nextCount;
    subscription.dunningNextRetryAt = computeDunningNextRetryAt(
      subscription.nextBillingDate,
      nextCount,
    );
    subscription.lastPaymentFailureReason = mapped.code;
    subscription.lastPaymentFailureDetail = reason;
    subscription.billingHistory = [
      ...(subscription.billingHistory ?? []),
      {
        date: new Date(),
        amount: 0,
        currency: subscription.planPrice?.currency ?? 'USD',
        status: 'failed' as const,
        invoiceId: reference,
        failureReason: mapped.code,
      },
    ];
    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(`renewal_failed_${reference}`, 'renewal_failed', {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      reason: mapped.code,
      detail: reason,
    });

    const tenant = await this.tenantRepository.findOne({
      where: { id: subscription.tenantId },
      relations: ['createdBy'],
    });
    if (tenant) {
      subscription.tenant = tenant;
    }
    await this.notifyRenewalIssue(subscription, 'PAST_DUE', mapped.message);
  }

  private resetDunningFields(subscription: TenantSubscription): void {
    subscription.dunningAttemptCount = 0;
    subscription.dunningNextRetryAt = null;
    subscription.lastPaymentFailureReason = null;
    subscription.lastPaymentFailureDetail = null;
  }

  private applyPaymentMethodFromWebhook(
    subscription: TenantSubscription,
    payment: SubscriptionWebhookPayment,
  ): void {
    if (payment.tokenKey?.trim()) {
      subscription.paymentMethodId = payment.tokenKey;
    }
    if (payment.cardBrand) {
      subscription.paymentMethodBrand = payment.cardBrand;
    }
    if (payment.cardLastFour) {
      subscription.paymentMethodLastFour = payment.cardLastFour;
    }
  }

  /** One idempotency key per subscription billing period — never keyed by dunning attempt. */
  private renewalPeriodEventId(subscriptionId: string, billingDate: Date): string {
    return `renewal_period_${subscriptionId}_${billingDate.toISOString()}`;
  }

  /** Deterministic Nomba order reference for a billing period (≤50 chars). */
  private buildNombaRenewalOrderReference(subscriptionId: string, billingDate: Date): string {
    const id = subscriptionId.replace(/-/g, '').slice(0, 24);
    const day = billingDate.toISOString().slice(0, 10).replace(/-/g, '');
    return `sub_ren_${id}_${day}`;
  }

  private advanceBillingPeriod(anchor: Date): { periodStart: Date; periodEnd: Date } {
    const periodStart = new Date(anchor);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return { periodStart, periodEnd };
  }

  /** Prefer Bachs/Polar period dates from webhooks over local month arithmetic. */
  private resolveBillingPeriod(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
    billingPeriodAnchor?: Date,
  ): { periodStart: Date; periodEnd: Date; nextBillingDate: Date } {
    const nextFromProvider = payment.nextBillingDate ? new Date(payment.nextBillingDate) : null;
    const endFromProvider = payment.currentPeriodEnd ? new Date(payment.currentPeriodEnd) : null;
    const startFromProvider = payment.currentPeriodStart
      ? new Date(payment.currentPeriodStart)
      : null;

    if (nextFromProvider && !Number.isNaN(nextFromProvider.getTime())) {
      const periodStart =
        startFromProvider && !Number.isNaN(startFromProvider.getTime())
          ? startFromProvider
          : new Date(billingPeriodAnchor ?? subscription.nextBillingDate);
      const periodEnd =
        endFromProvider && !Number.isNaN(endFromProvider.getTime())
          ? endFromProvider
          : nextFromProvider;
      return { periodStart, periodEnd, nextBillingDate: nextFromProvider };
    }

    const periodStart = new Date(billingPeriodAnchor ?? subscription.nextBillingDate);
    const { periodEnd } = this.advanceBillingPeriod(periodStart);
    return { periodStart, periodEnd, nextBillingDate: periodEnd };
  }

  private async updateRenewalPeriodClaim(
    periodEventId: string,
    patch: Record<string, unknown>,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    const existing = await this.billingEventRepository.findOne({
      where: { eventId: periodEventId, provider },
    });
    if (existing) {
      existing.payload = { ...(existing.payload ?? {}), ...patch };
      await this.billingEventRepository.save(existing);
      return;
    }
    await this.recordBillingEvent(periodEventId, 'renewal_period', patch, provider);
  }

  private async healRenewalFromExistingPeriodCharge(
    subscription: TenantSubscription,
    periodEventId: string,
    provider: BillingProvider,
    attemptCount: number,
  ): Promise<'charged' | 'skip' | 'none'> {
    const existing = await this.billingEventRepository.findOne({
      where: { eventId: periodEventId, provider },
    });
    if (!existing?.payload || typeof existing.payload !== 'object') {
      return 'none';
    }

    const payload = existing.payload as Record<string, unknown>;
    if (payload.status === 'success') {
      return 'skip';
    }

    const orderReference =
      typeof payload.orderReference === 'string' ? payload.orderReference.trim() : '';
    if (!orderReference) {
      return 'none';
    }

    const verified = await this.verifyPaymentReference(orderReference, provider);
    if (
      !verified ||
      (this.requiresProviderVerification(provider) && !isNoahPaymentVerified(verified.status))
    ) {
      const status = String(verified?.status ?? 'missing').toLowerCase();
      if (status === 'pending' || status === 'processing') {
        return 'skip';
      }
      return 'none';
    }

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice?.isActive) {
      return 'none';
    }

    const seatCount = await this.getTenantSeatCount(subscription.tenantId);
    const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
    const normalizedPaid = normalizeWebhookAmount(
      Number(verified.amount ?? 0),
      expectedAmount,
      planPrice.currency,
    );

    await this.applyRenewalSuccess(
      subscription.tenantId,
      {
        eventId: orderReference,
        reference: orderReference,
        tenantId: subscription.tenantId,
        planId: subscription.planId,
        planPriceId: subscription.planPriceId,
        quantity: seatCount,
        amount: normalizedPaid,
        currency: planPrice.currency.toUpperCase(),
        tokenKey: subscription.paymentMethodId ?? undefined,
        status: 'success',
        billingType: BillingChargeType.SUBSCRIPTION_RENEWAL,
      },
      provider,
      subscription.nextBillingDate,
      attemptCount,
    );
    await this.updateRenewalPeriodClaim(
      periodEventId,
      { status: 'success', orderReference },
      provider,
    );
    return 'charged';
  }

  private async claimRenewalPeriodCharge(
    subscriptionId: string,
    periodEventId: string,
    tenantId: string,
    provider: BillingProvider,
  ): Promise<'proceed' | 'skip'> {
    return this.dataSource.transaction(async (manager) => {
      const subscriptionRepo = manager.getRepository(TenantSubscription);
      const billingEventRepo = manager.getRepository(BillingEvent);

      const locked = await subscriptionRepo.findOne({
        where: { id: subscriptionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.nextBillingDate > new Date()) {
        return 'skip';
      }

      const existing = await billingEventRepo.findOne({
        where: { eventId: periodEventId, provider },
      });
      if (existing?.payload && typeof existing.payload === 'object') {
        const status = (existing.payload as Record<string, unknown>).status;
        if (status === 'success') {
          return 'skip';
        }
        if (status === 'pending') {
          const ageMs = Date.now() - existing.createdAt.getTime();
          if (ageMs < RENEWAL_PENDING_CLAIM_TTL_MS) {
            return 'skip';
          }
        }
        existing.payload = {
          ...(existing.payload as Record<string, unknown>),
          status: 'pending',
          claimedAt: new Date().toISOString(),
          retryAt: new Date().toISOString(),
        };
        await billingEventRepo.save(existing);
        return 'proceed';
      }

      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: periodEventId,
          provider,
          eventType: 'renewal_period',
          payload: {
            status: 'pending',
            tenantId,
            subscriptionId,
            claimedAt: new Date().toISOString(),
          },
        }),
      );
      return 'proceed';
    });
  }

  private async recordBillingEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    const existing = await this.billingEventRepository.findOne({
      where: { eventId, provider },
    });
    if (existing) return;

    await this.billingEventRepository.save(
      this.billingEventRepository.create({
        eventId,
        provider,
        eventType,
        payload,
      }),
    );
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

    if (!isAllowedTenantFrontendOrigin(tenantSlug, parsed.origin)) {
      throw new BadRequestException('Success URL must use the application frontend origin');
    }

    if (isSubdomainTenantsEnabled()) {
      if (parsed.pathname.startsWith(`/${tenantSlug}/`)) {
        throw new BadRequestException('Success URL must not include workspace slug in path');
      }
    } else if (!parsed.pathname.startsWith(`/${tenantSlug}/`)) {
      throw new BadRequestException('Success URL must stay within your workspace path');
    }

    return successUrl;
  }

  private async processInitialPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID_PATTERN.test(payment.tenantId)) {
      throw new BadRequestException('Invalid tenant in webhook metadata');
    }

    if (await this.hasProcessedEvent(payment.eventId, provider)) {
      return;
    }

    if (!payment.planPriceId || !payment.planId) {
      throw new BadRequestException('Webhook missing plan metadata');
    }

    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
    });
    if (
      existingSubscription?.status === SubscriptionStatus.ACTIVE &&
      existingSubscription.nextBillingDate > new Date() &&
      existingSubscription.planId === payment.planId &&
      existingSubscription.planPriceId === payment.planPriceId
    ) {
      await this.recordBillingEvent(
        payment.eventId,
        'payment_success_skipped',
        { tenantId: payment.tenantId, reason: 'already_paid_current_period' },
        provider,
      );
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Payment could not be verified with billing provider');
    }

    const planPrice = await this.plansService.getPlanPriceById(payment.planPriceId);
    if (!planPrice?.isActive || planPrice.planId !== payment.planId) {
      throw new BadRequestException('Webhook plan metadata does not match records');
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: payment.tenantId } });
    if (!tenant) {
      throw new BadRequestException('Unknown tenant in webhook metadata');
    }

    const seatCount = resolveSeatCount(
      payment.quantity ?? (await this.getTenantSeatCount(payment.tenantId)),
    );
    const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);
    const planCurrency = planPrice.currency.toUpperCase();
    const paidCurrency = (payment.currency ?? planCurrency).toUpperCase();
    const sameCurrency = paidCurrency === planCurrency;

    if (sameCurrency) {
      if (
        !Number.isFinite(normalizedPaid) ||
        !isAmountWithinTolerance(normalizedPaid, expectedAmount)
      ) {
        this.logger.error(
          `Payment amount mismatch for tenant ${payment.tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
        );
        throw new BadRequestException('Payment amount does not match server quote');
      }
    } else if (
      provider === BillingProvider.BACHS &&
      Number.isFinite(payment.amount) &&
      payment.amount > 0
    ) {
      this.logger.warn(
        `Bachs cross-currency payment for tenant ${payment.tenantId}: catalog ${planCurrency}, paid ${paidCurrency} ${payment.amount}`,
      );
    } else {
      this.logger.error(
        `Cross-currency payment rejected for tenant ${payment.tenantId}: expected ${planCurrency}, got ${paidCurrency}`,
      );
      throw new BadRequestException('Payment amount does not match server quote');
    }

    const recordedAmount =
      sameCurrency && Number.isFinite(normalizedPaid) ? normalizedPaid : Number(payment.amount);

    if (this.requiresCardToken(provider) && !payment.tokenKey?.trim()) {
      throw new BadRequestException('Missing card token for subscription billing');
    }

    if (
      existingSubscription &&
      [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE].includes(
        existingSubscription.status,
      ) &&
      existingSubscription.nextBillingDate <= new Date() &&
      existingSubscription.planId === planPrice.planId &&
      existingSubscription.planPriceId === planPrice.id
    ) {
      await this.applyRenewalSuccess(
        payment.tenantId,
        { ...payment, billingType: BillingChargeType.SUBSCRIPTION_RENEWAL },
        provider,
        existingSubscription.nextBillingDate,
      );
      await this.recordBillingEvent(
        payment.eventId,
        'payment_success',
        { tenantId: payment.tenantId, routedAs: 'renewal_recovery' },
        provider,
      );
      return;
    }

    if (
      existingSubscription &&
      isManagedSubscriptionProvider(existingSubscription.billingProvider) &&
      existingSubscription.billingProvider !== provider &&
      existingSubscription.externalSubscriptionId
    ) {
      try {
        await this.cancelManagedExternalSubscription(existingSubscription, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to cancel old subscription during provider switch for tenant ${existingSubscription.tenantId}: ${message}`,
        );
      }
      existingSubscription.externalSubscriptionId = null;
      await this.subscriptionRepository.save(existingSubscription);
    }

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      const existing = await billingEventRepo.findOne({
        where: { eventId: payment.eventId, provider },
      });
      if (existing) return;

      const subscriptionRepo = manager.getRepository(TenantSubscription);
      let subscription = await subscriptionRepo.findOne({ where: { tenantId: payment.tenantId } });

      if (
        subscription?.status === SubscriptionStatus.ACTIVE &&
        subscription.billingProvider === BillingProvider.NOMBA &&
        subscription.nombaSubscriptionId &&
        subscription.nombaSubscriptionId !== payment.reference
      ) {
        throw new BadRequestException('Tenant already has a different active billing reference');
      }

      const now = new Date();
      const isFirstPaidActivation =
        !subscription ||
        subscription.status === SubscriptionStatus.TRIAL ||
        subscription.status === SubscriptionStatus.INACTIVE ||
        subscription.status === SubscriptionStatus.EXPIRED;

      let periodStart: Date;
      let periodEnd: Date;
      let nextBillingDate: Date;

      if (isManagedSubscriptionProvider(provider) && payment.nextBillingDate) {
        const resolved = this.resolveBillingPeriod(
          payment,
          subscription ?? ({ nextBillingDate: now } as TenantSubscription),
        );
        periodStart = resolved.periodStart;
        periodEnd = resolved.periodEnd;
        nextBillingDate = resolved.nextBillingDate;
      } else {
        const advanced = isFirstPaidActivation
          ? this.advanceBillingPeriod(now)
          : this.advanceBillingPeriod(
              subscription!.nextBillingDate <= now ? subscription!.nextBillingDate : now,
            );
        periodStart = advanced.periodStart;
        periodEnd = advanced.periodEnd;
        nextBillingDate = periodEnd;
      }

      if (!subscription) {
        subscription = subscriptionRepo.create({
          tenantId: payment.tenantId,
          planId: planPrice.planId,
          planPriceId: planPrice.id,
          status: SubscriptionStatus.ACTIVE,
          currentUsers: seatCount,
          trialEndsAt: null,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate,
          nombaSubscriptionId: provider === BillingProvider.NOMBA ? payment.reference : null,
          billingProvider: provider,
          externalSubscriptionId: payment.externalSubscriptionId ?? null,
          paymentMethodId: payment.tokenKey ?? payment.externalSubscriptionId ?? null,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          usageMetrics: {},
          billingHistory: [],
        });
        this.applyPaymentMethodFromWebhook(subscription, payment);
        this.resetDunningFields(subscription);
      } else {
        subscription.planId = planPrice.planId;
        subscription.planPriceId = planPrice.id;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.currentUsers = seatCount;
        subscription.trialEndsAt = null;
        subscription.currentPeriodStart = periodStart;
        subscription.currentPeriodEnd = periodEnd;
        subscription.nextBillingDate = nextBillingDate;
        subscription.nombaSubscriptionId =
          provider === BillingProvider.NOMBA ? payment.reference : subscription.nombaSubscriptionId;
        subscription.billingProvider = provider;
        subscription.externalSubscriptionId =
          payment.externalSubscriptionId ?? subscription.externalSubscriptionId;
        subscription.paymentMethodId =
          payment.tokenKey ?? payment.externalSubscriptionId ?? subscription.paymentMethodId;
        subscription.cancelAtPeriodEnd = false;
        subscription.cancelledAt = null;
        subscription.cancellationReason = null;
        this.applyPaymentMethodFromWebhook(subscription, payment);
        this.resetDunningFields(subscription);
      }

      subscription.billingHistory = [
        ...(subscription.billingHistory ?? []),
        {
          date: now,
          amount: recordedAmount,
          currency: payment.currency,
          status: 'paid' as const,
          invoiceId: payment.reference,
        },
      ];

      await subscriptionRepo.save(subscription);
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: payment.eventId,
          provider,
          eventType: 'payment_success',
          payload: payment as unknown as Record<string, unknown>,
        }),
      );
    });

    const externalId =
      payment.externalSubscriptionId?.trim() ||
      existingSubscription?.externalSubscriptionId?.trim() ||
      '';
    if (provider === BillingProvider.BACHS && externalId) {
      await this.endProviderTrialBestEffort(provider, externalId, payment.tenantId);
    }
  }

  private async processCardUpdateSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !UUID_PATTERN.test(payment.tenantId) ||
      (await this.hasProcessedEvent(payment.eventId, provider))
    ) {
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Card update payment could not be verified');
    }

    if (!payment.tokenKey?.trim()) {
      throw new BadRequestException('Missing card token from card update webhook');
    }

    if (
      !Number.isFinite(payment.amount) ||
      !isAmountWithinTolerance(payment.amount, CARD_UPDATE_VERIFY_AMOUNT)
    ) {
      throw new BadRequestException('Card update amount does not match verification charge');
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found for card update');
    }

    this.applyPaymentMethodFromWebhook(subscription, payment);
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      this.resetDunningFields(subscription);
    }

    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      payment.eventId,
      'card_update_success',
      {
        tenantId: payment.tenantId,
        reference: payment.reference,
      },
      provider,
    );
  }

  private async processRenewalPaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!UUID_PATTERN.test(payment.tenantId)) {
      throw new BadRequestException('Invalid tenant in webhook metadata');
    }

    if (await this.hasProcessedEvent(payment.eventId, provider)) {
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Renewal payment could not be verified');
    }

    await this.applyRenewalSuccess(payment.tenantId, payment, provider);
  }

  private async processQuantityUpdatePaymentSuccess(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (!payment.reference || (await this.hasProcessedEvent(payment.eventId, provider))) {
      return;
    }

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
      relations: ['planPrice'],
    });
    if (!subscription) {
      return;
    }

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice) {
      this.logger.warn(
        `Quantity update webhook for tenant ${payment.tenantId}: plan price not found`,
      );
      return;
    }

    const targetSeatCount = resolveSeatCount(
      payment.targetSeatCount ??
        payment.quantity ??
        subscription.usageMetrics?.pendingSeatCount ??
        subscription.currentUsers,
    );
    const extraSeats =
      payment.extraSeats ??
      subscription.usageMetrics?.pendingExtraSeats ??
      Math.max(0, targetSeatCount - subscription.currentUsers);

    const expectedAmount =
      subscription.usageMetrics?.pendingChargeAmount ??
      calculateProratedSeatCharge(
        planPrice,
        extraSeats,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
      ).amount;

    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);

    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    ) {
      this.logger.error(
        `Quantity update amount mismatch for tenant ${payment.tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Seat addition payment amount does not match server quote');
    }

    subscription.currentUsers = targetSeatCount;
    subscription.usageMetrics = {
      ...(subscription.usageMetrics ?? {}),
      pendingSeatCount: undefined,
      pendingExtraSeats: undefined,
      pendingChargeAmount: undefined,
      pendingSeatChargedAt: undefined,
    };

    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      payment.eventId,
      'quantity_update_success',
      {
        ...payment,
        quantity: targetSeatCount,
        extraSeats,
      } as unknown as Record<string, unknown>,
      provider,
    );
  }

  private async processPaymentFailed(
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (
      !UUID_PATTERN.test(payment.tenantId) ||
      (await this.hasProcessedEvent(payment.eventId, provider))
    ) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
      relations: ['tenant', 'tenant.createdBy', 'planPrice'],
    });
    if (!subscription) {
      return;
    }

    if (payment.billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE) {
      subscription.usageMetrics = {
        ...(subscription.usageMetrics ?? {}),
        pendingSeatCount: undefined,
        pendingExtraSeats: undefined,
        pendingChargeAmount: undefined,
        pendingSeatChargedAt: undefined,
      };
      await this.subscriptionRepository.save(subscription);
      await this.recordBillingEvent(
        payment.eventId,
        'quantity_update_failed',
        {
          ...payment,
        } as unknown as Record<string, unknown>,
        provider,
      );
      return;
    }

    if (payment.billingType === BillingChargeType.SUBSCRIPTION_RENEWAL) {
      await this.markRenewalFailed(subscription, payment.reference, 'renewal_payment_failed');
      await this.recordBillingEvent(
        payment.eventId,
        'renewal_failed_webhook',
        {
          ...payment,
        } as unknown as Record<string, unknown>,
        provider,
      );
      return;
    }

    await this.recordBillingEvent(
      payment.eventId,
      'payment_failed',
      {
        ...payment,
      } as unknown as Record<string, unknown>,
      provider,
    );
    await this.notifyRenewalIssue(
      subscription,
      'PAYMENT_FAILED',
      'Initial subscription payment failed.',
    );
  }

  private async applyRenewalSuccess(
    tenantId: string,
    payment: SubscriptionWebhookPayment,
    provider: BillingProvider = BillingProvider.NOMBA,
    billingPeriodAnchor?: Date,
    attemptCount = 0,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({ where: { tenantId } });
    if (
      !subscription ||
      ![SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE].includes(subscription.status)
    ) {
      throw new BadRequestException('No renewable subscription found for tenant');
    }
    if (subscription.billingProvider !== provider) {
      this.logger.warn(
        `Ignoring renewal webhook from ${provider} for tenant ${tenantId}; active provider is ${subscription.billingProvider}`,
      );
      return;
    }

    const planId = payment.planId?.trim() || subscription.planId;
    const planPriceId = payment.planPriceId?.trim() || subscription.planPriceId;
    if (!planId || !planPriceId) {
      throw new BadRequestException('Renewal webhook missing plan metadata');
    }

    const planPrice = await this.plansService.getPlanPriceById(planPriceId);
    if (!planPrice?.isActive || planPrice.planId !== planId) {
      throw new BadRequestException('Renewal plan metadata does not match records');
    }

    payment.planId = planId;
    payment.planPriceId = planPriceId;

    const liveSeatCount = await this.getTenantSeatCount(tenantId);
    const chargedSeatCount = this.resolveChargedRenewalSeatCount(payment, subscription);
    const expectedAmount = calculatePerSeatTotal(planPrice, chargedSeatCount);
    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);

    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    ) {
      if (
        (provider === BillingProvider.BACHS || provider === BillingProvider.POLAR) &&
        Number.isFinite(payment.amount) &&
        payment.amount > 0
      ) {
        this.logger.warn(
          `${provider} renewal amount drift for tenant ${tenantId}: expected ${expectedAmount}, got ${payment.amount}; accepting provider invoice`,
        );
      } else {
        this.logger.error(
          `Renewal amount mismatch for tenant ${tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
        );
        throw new BadRequestException('Renewal amount does not match server quote');
      }
    }

    if (liveSeatCount !== chargedSeatCount) {
      this.logger.warn(
        `Seat count drift on renewal for tenant ${tenantId}: live=${liveSeatCount}, charged=${chargedSeatCount}`,
      );
    }

    const paidAmount =
      Number.isFinite(normalizedPaid) && isAmountWithinTolerance(normalizedPaid, expectedAmount)
        ? normalizedPaid
        : Number(payment.amount);

    let shouldSyncSeatsAfter = false;

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      const existing = await billingEventRepo.findOne({
        where: { eventId: payment.eventId, provider },
      });
      if (existing) return;

      const subscriptionRepo = manager.getRepository(TenantSubscription);
      const locked = await subscriptionRepo.findOne({
        where: { tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new BadRequestException('Subscription not found during renewal');
      }

      if (locked.cancelAtPeriodEnd) {
        await billingEventRepo.save(
          billingEventRepo.create({
            eventId: payment.eventId,
            provider,
            eventType: 'renewal_ignored_cancel_scheduled',
            payload: payment as unknown as Record<string, unknown>,
          }),
        );
        return;
      }

      const periodEventId = this.renewalPeriodEventId(
        locked.id,
        billingPeriodAnchor ?? locked.nextBillingDate,
      );
      const periodClaim = await billingEventRepo.findOne({
        where: { eventId: periodEventId, provider },
      });

      if (locked.nextBillingDate > new Date()) {
        await billingEventRepo.save(
          billingEventRepo.create({
            eventId: payment.eventId,
            provider,
            eventType: 'subscription_renewal',
            payload: payment as unknown as Record<string, unknown>,
          }),
        );
        return;
      }

      if (periodClaim?.payload && typeof periodClaim.payload === 'object') {
        const claimPayload = periodClaim.payload as Record<string, unknown>;
        const claimStatus = claimPayload.status;
        if (claimStatus === 'success') {
          return;
        }
        if (claimStatus === 'pending' || claimStatus === 'charged') {
          const claimRef =
            typeof claimPayload.orderReference === 'string' ? claimPayload.orderReference : '';
          const sameCharge = Boolean(claimRef && claimRef === payment.reference);
          if (!sameCharge) {
            const claimedAtRaw =
              claimPayload.claimedAt ?? periodClaim.updatedAt ?? periodClaim.createdAt;
            const claimedAt = new Date(String(claimedAtRaw));
            const ageMs = Number.isNaN(claimedAt.getTime())
              ? Number.POSITIVE_INFINITY
              : Date.now() - claimedAt.getTime();
            if (ageMs < RENEWAL_PENDING_CLAIM_TTL_MS) {
              await billingEventRepo.save(
                billingEventRepo.create({
                  eventId: payment.eventId,
                  provider,
                  eventType: 'renewal_deferred_inflight_claim',
                  payload: payment as unknown as Record<string, unknown>,
                }),
              );
              return;
            }
          }
        }
      }

      const periodStart = new Date(billingPeriodAnchor ?? locked.nextBillingDate);
      const advanced = this.advanceBillingPeriod(periodStart);
      const billingPeriod = isManagedSubscriptionProvider(provider)
        ? this.resolveBillingPeriod(payment, locked, billingPeriodAnchor)
        : { ...advanced, nextBillingDate: advanced.periodEnd };

      locked.status = SubscriptionStatus.ACTIVE;
      locked.currentUsers = liveSeatCount;
      locked.currentPeriodStart = billingPeriod.periodStart;
      locked.currentPeriodEnd = billingPeriod.periodEnd;
      locked.nextBillingDate = billingPeriod.nextBillingDate;
      // Keep the original Nomba checkout reference; renewal refs are per-period charges.
      if (
        provider === BillingProvider.NOMBA &&
        payment.billingType !== BillingChargeType.SUBSCRIPTION_RENEWAL &&
        !locked.nombaSubscriptionId
      ) {
        locked.nombaSubscriptionId = payment.reference;
      }
      locked.billingProvider = provider;
      this.applyPaymentMethodFromWebhook(locked, payment);
      this.resetDunningFields(locked);

      locked.billingHistory = [
        ...(locked.billingHistory ?? []),
        {
          date: new Date(),
          amount: paidAmount,
          currency: payment.currency,
          status: 'paid' as const,
          invoiceId: payment.reference,
        },
      ];

      await subscriptionRepo.save(locked);
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: payment.eventId,
          provider,
          eventType: 'subscription_renewal',
          payload: payment as unknown as Record<string, unknown>,
        }),
      );
      const periodPayload = {
        status: 'success',
        tenantId,
        subscriptionId: locked.id,
        orderReference: payment.reference,
        billingPeriodStart: billingPeriod.periodStart,
      };
      if (periodClaim) {
        periodClaim.payload = { ...(periodClaim.payload ?? {}), ...periodPayload };
        await billingEventRepo.save(periodClaim);
      } else {
        await billingEventRepo.save(
          billingEventRepo.create({
            eventId: periodEventId,
            provider,
            eventType: 'renewal_period',
            payload: periodPayload,
          }),
        );
      }

      shouldSyncSeatsAfter = liveSeatCount > chargedSeatCount;
    });

    if (shouldSyncSeatsAfter) {
      await this.syncSubscriptionQuantity(tenantId).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Post-renewal seat sync failed for tenant ${tenantId}: ${message}`);
      });
    }
  }

  /** Seat count used to verify the paid renewal amount (webhook/cron charge metadata). */
  private resolveChargedRenewalSeatCount(
    payment: SubscriptionWebhookPayment,
    subscription: TenantSubscription,
  ): number {
    if (payment.quantity != null && Number.isFinite(payment.quantity)) {
      return resolveSeatCount(payment.quantity);
    }
    return resolveSeatCount(subscription.currentUsers ?? 1);
  }

  private hasProcessedEvent(eventId: string, provider?: BillingProvider): Promise<boolean> {
    if (provider) {
      return this.billingEventRepository.exists({
        where: { eventId, provider },
      });
    }
    return this.billingEventRepository.exists({ where: { eventId } });
  }
}
