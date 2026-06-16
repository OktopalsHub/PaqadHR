import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { DataSource, Repository } from 'typeorm';
import { PlansService } from '../../plans/services/plans.service';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { isBillingGatewayEnabled } from '../config/billing.config';
import { BillingProvider } from '../constants/billing-provider.enum';
import {
  BillingChargeType,
  RENEWAL_GRACE_PERIOD_DAYS,
} from '../constants/billing.constants';
import { BillingEvent } from '../entities/billing-event.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import type {
  SubscriptionBillingMetadata,
  SubscriptionWebhookPayment,
} from '../interfaces/subscription-billing.interface';
import { NombaSubscriptionProvider } from '../providers/nomba-subscription.provider';
import {
  calculatePerSeatTotal,
  isAmountWithinTolerance,
  normalizeWebhookAmount,
  resolveSeatCount,
} from '../utils/per-seat-pricing.util';
import { NombaApiService } from './nomba-api.service';
import { SubscriptionsService } from './subscriptions.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    private readonly nombaProvider: NombaSubscriptionProvider,
    private readonly nombaApi: NombaApiService,
    private readonly subscriptionsService: SubscriptionsService,
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
  ) {}

  async getTenantSeatCount(tenantId: string): Promise<number> {
    const count = await this.tenantMemberRepository.count({
      where: { tenantId, isActive: true },
    });
    return resolveSeatCount(count);
  }

  async getBillingOverview(tenantId: string, canManageBilling: boolean) {
    const [tenant, billingStatus, seatCount] = await Promise.all([
      this.tenantRepository.findOne({ where: { id: tenantId } }),
      this.subscriptionsService.getBillingStatus(tenantId),
      this.getTenantSeatCount(tenantId),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const countryCode = tenant.countryCode || 'GLOBAL';
    const planPrices = await this.plansService.getPricesForCountry(countryCode);
    const paymentsEnabled = isBillingGatewayEnabled();

    const plans = planPrices
      .filter((price) => price.plan?.isActive)
      .map((price) => this.toPlanQuote(price, seatCount))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...billingStatus,
      seatCount,
      countryCode,
      currency: tenant.preferredCurrency ?? plans[0]?.currency ?? 'USD',
      canManageBilling: canManageBilling && paymentsEnabled,
      plans: paymentsEnabled ? plans : [],
    };
  }

  async createSubscriptionCheckout(
    tenantId: string,
    planSlug: string,
    userId: string,
    successUrl?: string,
  ) {
    this.nombaProvider.ensureConfigured();

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
    if (existing?.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Organization already has an active paid subscription');
    }

    const planPrice = await this.plansService.getPlanPrice(
      normalizedSlug,
      tenant.countryCode || 'GLOBAL',
      tenant.preferredCurrency ?? undefined,
    );
    if (!planPrice) {
      throw new NotFoundException(`Plan "${normalizedSlug}" is not available for your region`);
    }

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

    const checkout = await this.nombaProvider.createCheckout(
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
    };
  }

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!this.nombaProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const event = this.nombaProvider.parseWebhook(payload);
    if (!event || event.kind === 'ignored') {
      return { received: true };
    }

    if (event.kind === 'payment.success') {
      const billingType = event.payment.billingType;
      if (billingType === BillingChargeType.SUBSCRIPTION_RENEWAL) {
        await this.processRenewalPaymentSuccess(event.payment);
      } else if (billingType === BillingChargeType.SUBSCRIPTION_QUANTITY_UPDATE) {
        await this.processQuantityUpdatePaymentSuccess(event.payment);
      } else {
        await this.processInitialPaymentSuccess(event.payment);
      }
    }

    return { received: true };
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
      !subscription.nombaSubscriptionId ||
      !subscription.paymentMethodId
    ) {
      return;
    }

    const quantity = await this.getTenantSeatCount(tenantId);
    if (subscription.currentUsers === quantity) return;

    const planPrice =
      subscription.planPrice ??
      (await this.plansService.getPlanPriceById(subscription.planPriceId));
    if (!planPrice) {
      this.logger.warn(`Plan price ${subscription.planPriceId} not found for tenant ${tenantId}`);
      return;
    }

    const ownerEmail = subscription.tenant?.createdBy?.email;
    if (!ownerEmail) {
      this.logger.warn(`No billing contact email found for tenant ${tenantId}`);
      return;
    }

    await this.nombaProvider.updateSubscription(
      subscription.nombaSubscriptionId,
      planPrice,
      quantity,
      subscription.paymentMethodId,
      ownerEmail,
    );

    subscription.currentUsers = quantity;
    await this.subscriptionRepository.save(subscription);
  }

  async processDueRenewals(): Promise<RenewalJobResult> {
    const result: RenewalJobResult = { charged: 0, failed: 0, skipped: 0, suspended: 0 };
    if (!isBillingGatewayEnabled()) {
      return result;
    }

    this.nombaProvider.ensureConfigured();

    const now = new Date();
    result.suspended = await this.suspendPastGraceSubscriptions(now);

    const dueSubscriptions = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.planPrice', 'planPrice')
      .leftJoinAndSelect('sub.tenant', 'tenant')
      .leftJoinAndSelect('tenant.createdBy', 'createdBy')
      .where('sub.next_billing_date <= :now', { now })
      .andWhere('sub.payment_method_id IS NOT NULL')
      .andWhere('sub.nomba_subscription_id IS NOT NULL')
      .andWhere('sub.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
      })
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
    const attemptEventId = this.renewalAttemptEventId(
      subscription.id,
      subscription.nextBillingDate,
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

    const ownerEmail = subscription.tenant?.createdBy?.email;
    const tokenKey = subscription.paymentMethodId;
    const nombaReference = subscription.nombaSubscriptionId;
    if (!ownerEmail || !tokenKey || !nombaReference) {
      this.logger.warn(`Skipping renewal for ${subscription.tenantId}: missing billing credentials`);
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
      const charge = await this.nombaProvider.chargeRenewal(
        nombaReference,
        planPrice,
        seatCount,
        tokenKey,
        ownerEmail,
        metadata,
      );

      const verified = await this.nombaApi.verifyTransaction(charge.orderReference);
      if (!verified || verified.status?.toLowerCase() !== 'success') {
        await this.markRenewalFailed(subscription, charge.orderReference, 'verification_failed');
        return 'failed';
      }

      const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
      const normalizedPaid = normalizeWebhookAmount(
        Number(verified.amount ?? 0),
        expectedAmount,
        planPrice.currency,
      );

      await this.applyRenewalSuccess(subscription.tenantId, {
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
      }, subscription.nextBillingDate);

      return 'charged';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Renewal charge failed for tenant ${subscription.tenantId}: ${message}`);
      await this.markRenewalFailed(subscription, attemptEventId, message);
      return 'failed';
    }
  }

  private async suspendPastGraceSubscriptions(now: Date): Promise<number> {
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - RENEWAL_GRACE_PERIOD_DAYS);

    const update = await this.subscriptionRepository
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ status: SubscriptionStatus.SUSPENDED })
      .where('status = :status', { status: SubscriptionStatus.PAST_DUE })
      .andWhere('next_billing_date < :graceCutoff', { graceCutoff })
      .execute();

    return update.affected ?? 0;
  }

  private async markRenewalFailed(
    subscription: TenantSubscription,
    reference: string,
    reason: string,
  ): Promise<void> {
    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.billingHistory = [
      ...(subscription.billingHistory ?? []),
      {
        date: new Date(),
        amount: 0,
        currency: subscription.planPrice?.currency ?? 'USD',
        status: 'failed' as const,
        invoiceId: reference,
      },
    ];
    await this.subscriptionRepository.save(subscription);
    await this.recordBillingEvent(`renewal_failed_${reference}`, 'renewal_failed', {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      reason,
    });
  }

  private renewalAttemptEventId(subscriptionId: string, billingDate: Date): string {
    return `renewal_attempt_${subscriptionId}_${billingDate.toISOString()}`;
  }

  private async recordBillingEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.billingEventRepository.findOne({
      where: { eventId, provider: BillingProvider.NOMBA },
    });
    if (existing) return;

    await this.billingEventRepository.save(
      this.billingEventRepository.create({
        eventId,
        provider: BillingProvider.NOMBA,
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

  private async processInitialPaymentSuccess(payment: SubscriptionWebhookPayment): Promise<void> {
    if (!UUID_PATTERN.test(payment.tenantId)) {
      throw new BadRequestException('Invalid tenant in webhook metadata');
    }

    if (await this.hasProcessedEvent(payment.eventId)) {
      this.logger.log(`Skipping duplicate Nomba billing event ${payment.eventId}`);
      return;
    }

    const verified = await this.nombaApi.verifyTransaction(payment.reference);
    if (!verified || verified.status?.toLowerCase() !== 'success') {
      throw new BadRequestException('Payment could not be verified with Nomba');
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

    if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, expectedAmount)) {
      this.logger.error(
        `Nomba amount mismatch for tenant ${payment.tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Payment amount does not match server quote');
    }

    if (!payment.tokenKey?.trim()) {
      throw new BadRequestException('Missing card token for subscription billing');
    }

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      const existing = await billingEventRepo.findOne({
        where: { eventId: payment.eventId, provider: BillingProvider.NOMBA },
      });
      if (existing) return;

      const subscriptionRepo = manager.getRepository(TenantSubscription);
      let subscription = await subscriptionRepo.findOne({ where: { tenantId: payment.tenantId } });

      if (
        subscription?.status === SubscriptionStatus.ACTIVE &&
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
          nombaSubscriptionId: payment.reference,
          paymentMethodId: payment.tokenKey,
          usageMetrics: {},
          billingHistory: [],
        });
      } else {
        subscription.planId = planPrice.planId;
        subscription.planPriceId = planPrice.id;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.currentUsers = seatCount;
        subscription.trialEndsAt = null;
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = periodEnd;
        subscription.nextBillingDate = periodEnd;
        subscription.nombaSubscriptionId = payment.reference;
        subscription.paymentMethodId = payment.tokenKey ?? null;
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
          provider: BillingProvider.NOMBA,
          eventType: 'payment_success',
          payload: payment as unknown as Record<string, unknown>,
        }),
      );
    });

    this.logger.log(`Activated subscription for tenant ${payment.tenantId} via Nomba`);
  }

  private async processRenewalPaymentSuccess(payment: SubscriptionWebhookPayment): Promise<void> {
    if (!UUID_PATTERN.test(payment.tenantId)) {
      throw new BadRequestException('Invalid tenant in webhook metadata');
    }

    if (await this.hasProcessedEvent(payment.eventId)) {
      this.logger.log(`Skipping duplicate Nomba renewal event ${payment.eventId}`);
      return;
    }

    const verified = await this.nombaApi.verifyTransaction(payment.reference);
    if (!verified || verified.status?.toLowerCase() !== 'success') {
      throw new BadRequestException('Renewal payment could not be verified with Nomba');
    }

    await this.applyRenewalSuccess(payment.tenantId, payment);
    this.logger.log(`Renewed subscription for tenant ${payment.tenantId} via Nomba webhook`);
  }

  private async processQuantityUpdatePaymentSuccess(
    payment: SubscriptionWebhookPayment,
  ): Promise<void> {
    if (!payment.reference || (await this.hasProcessedEvent(payment.eventId))) {
      return;
    }

    const verified = await this.nombaApi.verifyTransaction(payment.reference);
    if (!verified || verified.status?.toLowerCase() !== 'success') {
      return;
    }

    await this.recordBillingEvent(payment.eventId, 'quantity_update_success', {
      ...payment,
    } as unknown as Record<string, unknown>);
  }

  private async applyRenewalSuccess(
    tenantId: string,
    payment: SubscriptionWebhookPayment,
    billingPeriodAnchor?: Date,
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

    const seatCount = resolveSeatCount(
      payment.quantity ?? subscription.currentUsers ?? (await this.getTenantSeatCount(tenantId)),
    );
    const expectedAmount = calculatePerSeatTotal(planPrice, seatCount);
    const normalizedPaid = normalizeWebhookAmount(payment.amount, expectedAmount, payment.currency);

    if (!Number.isFinite(normalizedPaid) || !isAmountWithinTolerance(normalizedPaid, expectedAmount)) {
      this.logger.error(
        `Nomba renewal amount mismatch for tenant ${tenantId}: expected ${expectedAmount}, got ${normalizedPaid}`,
      );
      throw new BadRequestException('Renewal amount does not match server quote');
    }

    await this.dataSource.transaction(async (manager) => {
      const billingEventRepo = manager.getRepository(BillingEvent);
      const existing = await billingEventRepo.findOne({
        where: { eventId: payment.eventId, provider: BillingProvider.NOMBA },
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
      );
      const attemptExists = await billingEventRepo.findOne({
        where: { eventId: attemptEventId, provider: BillingProvider.NOMBA },
      });

      if (locked.nextBillingDate > new Date()) {
        if (!existing) {
          await billingEventRepo.save(
            billingEventRepo.create({
              eventId: payment.eventId,
              provider: BillingProvider.NOMBA,
              eventType: 'subscription_renewal',
              payload: payment as unknown as Record<string, unknown>,
            }),
          );
        }
        return;
      }

      if (attemptExists) {
        return;
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
      if (payment.tokenKey?.trim()) {
        locked.paymentMethodId = payment.tokenKey;
      }

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
          provider: BillingProvider.NOMBA,
          eventType: 'subscription_renewal',
          payload: payment as unknown as Record<string, unknown>,
        }),
      );
      await billingEventRepo.save(
        billingEventRepo.create({
          eventId: attemptEventId,
          provider: BillingProvider.NOMBA,
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

  private hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.billingEventRepository.exists({
      where: { eventId, provider: BillingProvider.NOMBA },
    });
  }
}
