import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { PlansService } from '../../plans/services/plans.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { BillingProvider } from '../constants/billing-provider.enum';
import { getBillingFailureMessage } from '../utils/nomba-billing-failure.util';
import { calculatePerSeatTotal } from '../utils/per-seat-pricing.util';
import { BillingProviderFactoryService } from './billing-provider-factory.service';
import { SeatPricingCalculator } from './seat-pricing-calculator';
import { SubscriptionsService } from './subscriptions.service';

export class BillingOverviewService {
  constructor(
    private readonly billingProviderFactory: BillingProviderFactoryService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly plansService: PlansService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly seatPricing: SeatPricingCalculator,
  ) {}

  private providerForCountry(countryCode: string | null | undefined): BillingProvider {
    return this.billingProviderFactory.resolveBillingProvider(countryCode);
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
}
