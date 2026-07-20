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
import { Brackets, DataSource, LessThan, Repository } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { PlansService } from '../../plans/services/plans.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { BillingChargeType, RENEWAL_GRACE_PERIOD_DAYS } from '../constants/billing.constants';
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
    @Optional() private readonly notificationHelper?: NotificationHelperService,
  ) {}

  verifyBachsWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
    return this.billingProviderFactory
      .getBachsProvider()
      .verifyWebhookSignature(rawBody, signature, timestamp);
  }

  verifyPolarWebhookSignature(rawBody: string, signature: string): boolean {
    return this.billingProviderFactory
      .getPolarProvider()
      .verifyWebhookSignature(rawBody, signature);
  }

  private providerForCountry(countryCode: string | null | undefined): BillingProvider {
    return this.billingProviderFactory.resolveBillingProvider(countryCode);
  }

  private async verifyPaymentReference(reference: string, provider: BillingProvider) {
    if (provider !== BillingProvider.NOMBA) {
      return { status: 'success', amount: 0 };
    }
    return this.nombaApi.verifyTransaction(reference);
  }

  private requiresProviderVerification(provider: BillingProvider): boolean {
    return provider === BillingProvider.NOMBA;
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

  private isStaleProviderWebhook(
    subscription: TenantSubscription | null,
    webhookProvider: BillingProvider,
  ): boolean {
    if (!subscription?.billingProvider) {
      return false;
    }
    return subscription.billingProvider !== webhookProvider;
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

  private async prepareManagedProviderSwitch(
    subscription: TenantSubscription,
    targetProvider: BillingProvider,
  ): Promise<void> {
    if (
      subscription.billingProvider === targetProvider ||
      !isManagedSubscriptionProvider(subscription.billingProvider)
    ) {
      return;
    }

    await this.cancelManagedExternalSubscription(subscription, false);
    subscription.externalSubscriptionId = null;
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

    const tenantId = this.resolveWebhookTenantId(event);
    if (tenantId && UUID_PATTERN.test(tenantId)) {
      const subscription = await this.subscriptionRepository.findOne({ where: { tenantId } });
      if (this.isStaleProviderWebhook(subscription, provider)) {
        this.logger.warn(
          `Ignoring ${event.kind} webhook from ${provider} for tenant ${tenantId}; active provider is ${subscription?.billingProvider}`,
        );
        return { received: true };
      }
    }

    if (event.kind === 'payment.success') {
      const billingType = event.payment.billingType;
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
    if (!subscription || subscription.billingProvider !== provider) {
      return;
    }

    subscription.externalSubscriptionId = event.externalSubscriptionId;
    subscription.billingProvider = provider;
    subscription.paymentMethodId = subscription.paymentMethodId ?? event.externalSubscriptionId;
    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(
      event.eventId,
      'subscription_created',
      {
        tenantId: event.tenantId,
        externalSubscriptionId: event.externalSubscriptionId,
      },
      provider,
    );
  }

  private async processExternalSubscriptionCancelled(
    event: Extract<SubscriptionWebhookEvent, { kind: 'subscription.cancelled' }>,
    provider: BillingProvider,
  ): Promise<void> {
    if (await this.hasProcessedEvent(event.eventId, provider)) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId: event.tenantId },
    });
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
        tenantId: event.tenantId,
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

  async getBillingOverview(tenantId: string, canManageBilling: boolean) {
    const [tenant, billingStatus, seatCount, subscription, tenantSettings] = await Promise.all([
      this.tenantRepository.findOne({ where: { id: tenantId }, relations: ['createdBy'] }),
      this.subscriptionsService.getBillingStatus(tenantId),
      this.getTenantSeatCount(tenantId),
      this.subscriptionsService.getTenantSubscription(tenantId),
      this.tenantSettingsService.getTenantSettings(tenantId).catch(() => null),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const countryCode = tenant.countryCode || 'GLOBAL';
    const planPrices = await this.plansService.getPricesForCountry(countryCode);
    const _paymentsEnabled = isBillingGatewayEnabled();

    const plans = planPrices
      .filter((price) => price.plan?.isActive)
      .map((price) => this.toPlanQuote(price, seatCount))
      .sort((a, b) => a.name.localeCompare(b.name));

    const sub = billingStatus.subscription;
    const needsPayment = this.subscriptionsService.computeNeedsPayment(sub);

    const billingHistory = (subscription?.billingHistory ?? []).map((entry) => ({
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
      currency: tenant.preferredCurrency ?? plans[0]?.currency ?? 'USD',
      canManageBilling: canManageBilling,
      plans,
      companyName: tenant.name,
      nextBillingDate: subscription?.nextBillingDate?.toISOString() ?? null,
      hasPaymentMethodOnFile: Boolean(
        subscription?.nombaSubscriptionId ||
          subscription?.externalSubscriptionId ||
          subscription?.paymentMethodId,
      ),
      paymentMethodBrand: subscription?.paymentMethodBrand ?? null,
      paymentMethodLastFour: subscription?.paymentMethodLastFour ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      cancelledAt: subscription?.cancelledAt?.toISOString() ?? null,
      pausedAt: subscription?.pausedAt?.toISOString() ?? null,
      dunningNextRetryAt: subscription?.dunningNextRetryAt?.toISOString() ?? null,
      lastPaymentFailureReason: getBillingFailureMessage(subscription?.lastPaymentFailureReason),
      lastPaymentFailureCode: subscription?.lastPaymentFailureReason ?? null,
      billingHistory,
      needsPayment,
      billingContact: tenantSettings?.settings.billing ?? {},
      ownerEmail: tenant.createdBy?.email ?? null,
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

    const currentPlanSlug =
      existing?.plan?.slug?.toLowerCase() ?? existing?.plan?.name?.toLowerCase();
    const billingProvider = this.providerForCountry(tenant.countryCode);

    if (existing?.status === SubscriptionStatus.ACTIVE && currentPlanSlug === normalizedSlug) {
      if (existing.billingProvider === billingProvider) {
        throw new BadRequestException(
          'Organization already has an active subscription on this plan',
        );
      }
    }

    if (
      existing &&
      [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED].includes(
        existing.status,
      ) &&
      existing.billingProvider !== billingProvider &&
      isManagedSubscriptionProvider(existing.billingProvider)
    ) {
      await this.prepareManagedProviderSwitch(existing, billingProvider);
    }

    const planPrice = await this.plansService.getPlanPrice(
      normalizedSlug,
      tenant.countryCode || 'GLOBAL',
      tenant.preferredCurrency ?? undefined,
    );
    if (!planPrice) {
      throw new NotFoundException(`Plan "${normalizedSlug}" is not available for your region`);
    }

    this.billingProviderFactory.ensureConfigured(tenant.countryCode || 'GLOBAL');

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
      .getProviderForCountry(tenant.countryCode)
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
    const currency = planPrice?.currency ?? tenant.preferredCurrency ?? 'NGN';
    const billingProvider = this.providerForCountry(tenant.countryCode);

    this.billingProviderFactory.ensureConfigured(tenant.countryCode || 'GLOBAL');

    const billingProviderService = this.billingProviderFactory.getProviderForCountry(
      tenant.countryCode,
    );
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

    return this.subscriptionRepository.save(subscription);
  }

  async pauseSubscription(tenantId: string) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.PAST_DUE
    ) {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    subscription.status = SubscriptionStatus.PAUSED;
    subscription.pausedAt = new Date();
    subscription.cancelAtPeriodEnd = false;
    return this.subscriptionRepository.save(subscription);
  }

  async resumeSubscription(tenantId: string) {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (subscription.status !== SubscriptionStatus.PAUSED && !subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not paused or scheduled for cancellation');
    }
    if (!subscription.paymentMethodId) {
      throw new BadRequestException('Add a payment method before resuming');
    }
    if (new Date() >= subscription.currentPeriodEnd) {
      throw new BadRequestException('Subscription period has ended');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.pausedAt = null;
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

    if (subscription.usageMetrics?.pendingSeatCount != null) {
      return;
    }

    const liveSeats = await this.getTenantSeatCount(tenantId);
    const billedSeats = subscription.currentUsers;

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
    };
    await this.subscriptionRepository.save(subscription);
  }

  async processDueRenewals(): Promise<RenewalJobResult> {
    const result: RenewalJobResult = { charged: 0, failed: 0, skipped: 0, suspended: 0 };
    if (!isBillingGatewayEnabled()) {
      return result;
    }

    const now = new Date();
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
    const attemptEventId = this.renewalAttemptEventId(
      subscription.id,
      subscription.nextBillingDate,
      attemptCount,
    );
    if (await this.hasProcessedEvent(attemptEventId)) {
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
    const metadata: SubscriptionBillingMetadata = {
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      planPriceId: subscription.planPriceId,
      quantity: seatCount,
    };

    try {
      const billingProviderEnum =
        subscription.billingProvider ?? this.providerForCountry(subscription.tenant?.countryCode);

      if (isManagedSubscriptionProvider(billingProviderEnum)) {
        return 'skipped';
      }

      const billingProvider = this.billingProviderFactory.getProviderByEnum(billingProviderEnum);
      const charge = await billingProvider.chargeRenewal(
        nombaReference,
        planPrice,
        seatCount,
        tokenKey,
        billingEmail,
        metadata,
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
        await this.markRenewalFailed(subscription, charge.orderReference, 'verification_failed');
        await this.recordBillingEvent(attemptEventId, 'renewal_attempt', {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          attemptCount,
          failed: true,
        });
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

      return 'charged';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Renewal charge failed for tenant ${subscription.tenantId}: ${message}`);
      await this.markRenewalFailed(subscription, attemptEventId, message);
      await this.recordBillingEvent(attemptEventId, 'renewal_attempt', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        attemptCount,
        failed: true,
      });
      return 'failed';
    }
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

    await this.notificationHelper.sendBillingRenewalFailedNotification(
      ownerId,
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

  private renewalAttemptEventId(
    subscriptionId: string,
    billingDate: Date,
    attemptCount: number,
  ): string {
    return `renewal_attempt_${subscriptionId}_${billingDate.toISOString()}_${attemptCount}`;
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
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const fallback = `${frontendBase}/${tenantSlug}/settings?billing=success`;

    if (!successUrl?.trim()) return fallback;

    let parsed: URL;
    try {
      parsed = new URL(successUrl);
    } catch {
      throw new BadRequestException('Invalid success URL');
    }

    const allowedOrigin = new URL(frontendBase).origin;
    if (parsed.origin !== allowedOrigin) {
      throw new BadRequestException('Success URL must use the application frontend origin');
    }
    if (!parsed.pathname.startsWith(`/${tenantSlug}/`)) {
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

    const verified = await this.verifyPaymentReference(payment.reference, provider);
    if (
      this.requiresProviderVerification(provider) &&
      (!verified || !isNoahPaymentVerified(verified.status))
    ) {
      throw new BadRequestException('Payment could not be verified with billing provider');
    }

    if (!payment.planPriceId || !payment.planId) {
      throw new BadRequestException('Webhook missing plan metadata');
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

    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    ) {
      this.logger.error(
        `Nomba amount mismatch for tenant ${payment.tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Payment amount does not match server quote');
    }

    if (this.requiresCardToken(provider) && !payment.tokenKey?.trim()) {
      throw new BadRequestException('Missing card token for subscription billing');
    }

    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { tenantId: payment.tenantId },
    });
    if (
      existingSubscription &&
      isManagedSubscriptionProvider(existingSubscription.billingProvider) &&
      existingSubscription.billingProvider !== provider &&
      existingSubscription.externalSubscriptionId
    ) {
      await this.cancelManagedExternalSubscription(existingSubscription, false);
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
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      if (!subscription) {
        subscription = subscriptionRepo.create({
          tenantId: payment.tenantId,
          planId: planPrice.planId,
          planPriceId: planPrice.id,
          status: SubscriptionStatus.ACTIVE,
          currentUsers: seatCount,
          trialEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
          nombaSubscriptionId: provider === BillingProvider.NOMBA ? payment.reference : null,
          billingProvider: provider,
          externalSubscriptionId: payment.externalSubscriptionId ?? null,
          paymentMethodId: payment.tokenKey ?? payment.externalSubscriptionId ?? null,
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
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = periodEnd;
        subscription.nextBillingDate = periodEnd;
        subscription.nombaSubscriptionId =
          provider === BillingProvider.NOMBA ? payment.reference : subscription.nombaSubscriptionId;
        subscription.billingProvider = provider;
        subscription.externalSubscriptionId =
          payment.externalSubscriptionId ?? subscription.externalSubscriptionId;
        subscription.paymentMethodId =
          payment.tokenKey ?? payment.externalSubscriptionId ?? subscription.paymentMethodId;
        this.applyPaymentMethodFromWebhook(subscription, payment);
        this.resetDunningFields(subscription);
      }

      subscription.billingHistory = [
        ...(subscription.billingHistory ?? []),
        {
          date: now,
          amount: normalizedPaid,
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
    if (!payment.planPriceId || !payment.planId) {
      throw new BadRequestException('Renewal webhook missing plan metadata');
    }

    const planPrice = await this.plansService.getPlanPriceById(payment.planPriceId);
    if (!planPrice?.isActive || planPrice.planId !== payment.planId) {
      throw new BadRequestException('Renewal plan metadata does not match records');
    }

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

    const seatCount = resolveSeatCount(
      payment.quantity ?? subscription.currentUsers ?? (await this.getTenantSeatCount(tenantId)),
    );
    const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);

    if (
      !Number.isFinite(normalizedPaid) ||
      !isAmountWithinTolerance(normalizedPaid, expectedAmount)
    ) {
      this.logger.error(
        `Nomba renewal amount mismatch for tenant ${tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Renewal amount does not match server quote');
    }

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      const existing = await billingEventRepo.findOne({
        where: { eventId: payment.eventId, provider },
      });
      if (existing) return;

      const subscriptionRepo = manager.getRepository(TenantSubscription);
      const locked = await subscriptionRepo.findOne({ where: { tenantId } });
      if (!locked) {
        throw new BadRequestException('Subscription not found during renewal');
      }

      const attemptEventId = this.renewalAttemptEventId(
        locked.id,
        billingPeriodAnchor ?? locked.nextBillingDate,
        attemptCount,
      );
      const attemptExists = await billingEventRepo.findOne({
        where: { eventId: attemptEventId, provider },
      });

      if (locked.nextBillingDate > new Date()) {
        if (!existing) {
          await billingEventRepo.save(
            billingEventRepo.create({
              eventId: payment.eventId,
              provider,
              eventType: 'subscription_renewal',
              payload: payment as unknown as Record<string, unknown>,
            }),
          );
        }
        return;
      }

      if (attemptExists) {
        const attemptFailed =
          attemptExists.payload &&
          typeof attemptExists.payload === 'object' &&
          (attemptExists.payload as Record<string, unknown>).failed === true;
        if (!attemptFailed) {
          return;
        }
      }

      const periodStart = new Date(billingPeriodAnchor ?? locked.nextBillingDate);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      locked.status = SubscriptionStatus.ACTIVE;
      locked.currentUsers = seatCount;
      locked.currentPeriodStart = periodStart;
      locked.currentPeriodEnd = periodEnd;
      locked.nextBillingDate = periodEnd;
      locked.nombaSubscriptionId = payment.reference;
      locked.billingProvider = provider;
      this.applyPaymentMethodFromWebhook(locked, payment);
      this.resetDunningFields(locked);

      locked.billingHistory = [
        ...(locked.billingHistory ?? []),
        {
          date: new Date(),
          amount: normalizedPaid,
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
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: attemptEventId,
          provider,
          eventType: 'renewal_attempt',
          payload: {
            tenantId,
            subscriptionId: locked.id,
            orderReference: payment.reference,
            billingPeriodStart: periodStart,
          },
        }),
      );
    });
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
