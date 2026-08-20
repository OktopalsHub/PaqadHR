import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { resolveNgRewardsAirtimeProvider } from 'src/common/utils/ng-money-provider.util';
import {
  normalizeRewardsCatalogCountries,
  resolveGiftCardProviderFromEnv,
  resolveInitialWalletCurrency,
} from 'src/common/utils/rewards-defaults.util';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { Employment } from '../../employment/entities/employment.entity';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { Shoutout } from '../../shoutouts/entities/shoutout.entity';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CustomReward } from '../entities/custom-reward.entity';
import {
  type RedemptionStatus,
  RewardRedemption,
  type RewardType,
} from '../entities/reward-redemption.entity';
import { Task } from '../entities/task.entity';
import { TaskSubmission } from '../entities/task-submission.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';
import { CustomRewardsService } from './custom-rewards.service';
import { TenantWalletService } from './tenant-wallet.service';
import { TenantWalletTopupService } from './tenant-wallet-topup.service';

export interface CatalogItem {
  id: string;
  name: string;
  type: RewardType;
  pointsCost: number;
  currencyValue: number;
  currencyCode: string;
  countryCode?: string;
  imageUrl?: string | null;
  denominationType?: string;
  minDenomination?: number | null;
  maxDenomination?: number | null;
  fixedDenominations?: number[];
  deliveryInstructions?: string | null;
  stockLimit?: number | null;
  adminPricing?: {
    reloadlyCost: number;
    reloadlyCostCurrency: string;
  };
}

export interface ClaimInput {
  rewardType: RewardType;
  rewardId: string;
  rewardName?: string;
  pointsCost: number;
  currencyValue: number;
  currencyCode?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  /** Client-generated UUID; retries with the same key return the existing redemption. */
  idempotencyKey?: string;

  providerProductId?: number;
  airtimeNetwork?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  topupKind?: 'airtime' | 'data';
  billerId?: string | number;
  accountNumber?: string;
  serviceType?: string;
}

/** Maximum time in milliseconds a redemption can stay in PROCESSING before recovery kicks in. */
const PROCESSING_LEASE_MS = 5 * 60 * 1000; // 5 minutes

type ClaimCostBreakdown = {
  totalTenantDebit: number;
  expectedPointsCost: number;
  faceValueInRewardsCurrency: number;
};

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly customRewardsService: CustomRewardsService,
    readonly _tenantConfigService: TenantConfigService,
    private readonly fiatExchange: FiatExchangeService,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    readonly _nombaTransferApi: NombaTransferApiService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly activitiesService: ActivitiesService,
    private readonly tremendousApi: TremendousApiService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: ZeptomailEmailService,
  ) {}

  private async toWalletCurrency(
    localAmount: number,
    localCurrency: string,
    walletCurrency: string,
    operatorId?: number,
    countryCode?: string,
  ): Promise<number> {
    return this.fiatExchange.convert(localAmount, localCurrency, walletCurrency, {
      operatorId,
      countryCode,
    });
  }

  private async resolveSenderName(tenantId: string): Promise<string> {
    const tenant = await this.dataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
      select: { name: true },
    });
    return formatNombaSenderName(tenant?.name);
  }

  private resolveTremendousProduct(
    settings: RewardsSettings,
    rewardId: string,
  ): NonNullable<RewardsSettings['tremendousProducts']>[number] | undefined {
    if (!rewardId.startsWith('tremendous_')) return undefined;
    const rest = rewardId.slice('tremendous_'.length);
    const withCountry = rest.match(/^([A-Z]{2})_(.+)$/);
    if (withCountry) {
      const countryCode = withCountry[1];
      const productId = withCountry[2];
      return settings.tremendousProducts?.find(
        (p) => p.productId === productId && p.countryCode === countryCode,
      );
    }
    if (!rest) return undefined;
    return settings.tremendousProducts?.find((p) => p.productId === rest);
  }

  private extractTremendousProductId(rewardId: string): string | undefined {
    if (!rewardId.startsWith('tremendous_')) return undefined;
    const rest = rewardId.slice('tremendous_'.length);
    const withCountry = rest.match(/^([A-Z]{2})_(.+)$/);
    return withCountry ? withCountry[2] : rest || undefined;
  }

  private useMonnifyNgBills(): boolean {
    return resolveNgRewardsAirtimeProvider() === PaymentProvider.MONNIFY;
  }

  private assertNgNombaRouting(input: ClaimInput, settings: RewardsSettings): void {
    const _isNgCurrency =
      (input.currencyCode ?? settings.rewardsCurrency).toUpperCase() === 'NGN' &&
      settings.rewardsCurrency.toUpperCase() === 'NGN';

    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const configured = this.useMonnifyNgBills()
        ? this.monnifyBillApi.isConfigured()
        : this.nombaBillApi.isConfigured();
      if (!configured) {
        throw new BadRequestException('Nigeria redemptions are temporarily unavailable.');
      }
      return;
    }
  }

  async listNombaDataPlans(network: string) {
    if (this.useMonnifyNgBills()) {
      if (!this.monnifyBillApi.isConfigured()) {
        throw new BadRequestException('Data plans are temporarily unavailable.');
      }
      const plans = await this.monnifyBillApi.listDataPlans(network);
      return plans.map(({ amount, plan }) => ({ amount, plan }));
    }
    if (!this.nombaBillApi.isConfigured()) {
      throw new BadRequestException('Data plans are temporarily unavailable.');
    }
    return this.nombaBillApi.listDataPlans(network);
  }

  async getSubscriptionFees(
    tenantId: string,
    _walletCurrency: string,
  ): Promise<{ feePercentage: number; flatFee: number }> {
    try {
      const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
      const feePercentage = subscription?.planPrice?.regionalConfig?.rewardsFeePercentage ?? 2;
      return { feePercentage, flatFee: 0 };
    } catch {
      return { feePercentage: 2, flatFee: 0 };
    }
  }

  async getRedemptionFees(tenantId: string, currency: string) {
    return this.getSubscriptionFees(tenantId, currency);
  }

  private getTremendousCategory(
    _name: string,
    category?: string,
    subcategory?: string,
  ): 'Airtime' | 'Money Cards' | 'Gift Cards' | 'Gaming Cards' {
    const cat = `${category ?? ''} ${subcategory ?? ''}`.toLowerCase();
    if (
      cat.includes('visa') ||
      cat.includes('prepaid') ||
      cat.includes('ach') ||
      cat.includes('bank') ||
      cat.includes('debit')
    ) {
      return 'Money Cards';
    }
    if (cat.includes('gaming') || cat.includes('video_game') || cat.includes('entertainment')) {
      return 'Gaming Cards';
    }
    return 'Gift Cards';
  }

  private tremendousSkusToDenoms(skus: Array<{ min: number; max: number }> | undefined): {
    fixedDenominations: number[];
    minDenomination: number | null;
    maxDenomination: number | null;
  } {
    if (!skus?.length) {
      return { fixedDenominations: [], minDenomination: null, maxDenomination: null };
    }
    const fixed = skus
      .filter((sku) => sku.min === sku.max)
      .map((sku) => sku.min)
      .sort((a, b) => a - b);
    const ranges = skus.filter((sku) => sku.min !== sku.max);
    if (fixed.length > 0 && ranges.length === 0) {
      return {
        fixedDenominations: fixed,
        minDenomination: fixed[0],
        maxDenomination: fixed[fixed.length - 1],
      };
    }
    const min = Math.min(...skus.map((sku) => sku.min));
    const max = Math.max(...skus.map((sku) => sku.max));
    return { fixedDenominations: [], minDenomination: min, maxDenomination: max };
  }

  private async getRewardsContext(tenantId: string): Promise<{
    settings: RewardsSettings;
    countryCode: string | null;
  }> {
    const [row, tenant, wallet] = await Promise.all([
      this.dataSource.getRepository(TenantSettings).findOne({ where: { tenantId } }),
      this.dataSource.getRepository(Tenant).findOne({
        where: { id: tenantId },
        select: { id: true, countryCode: true, preferredCurrency: true },
      }),
      this.dataSource.getRepository(TenantWallet).findOne({ where: { tenantId } }),
    ]);
    const rewards = row?.settings?.rewards;
    const tenantCountry = GeoLocationHelper.toStoredCountryCode(tenant?.countryCode) ?? 'US';
    const rewardsCurrency = wallet
      ? wallet.currencyCode.toUpperCase()
      : resolveInitialWalletCurrency(tenant?.countryCode, tenant?.preferredCurrency);

    return {
      countryCode: tenant?.countryCode ?? null,
      settings: {
        enabled: rewards?.enabled ?? true,
        pointsExchangeRate: rewards?.pointsExchangeRate ?? 1,
        rewardsCurrency,
        catalogCountries: normalizeRewardsCatalogCountries(
          rewards?.catalogCountries,
          tenantCountry,
        ),
        airtimeEnabled: rewards?.airtimeEnabled ?? true,
        giftCardsEnabled: rewards?.giftCardsEnabled ?? true,
        giftCardCategories: rewards?.giftCardCategories ?? [
          'Gift Cards',
          'Gaming Cards',
          'Money Cards',
        ],
        giftCardProvider: resolveGiftCardProviderFromEnv(),
        utilityPaymentsEnabled: rewards?.utilityPaymentsEnabled ?? true,
        customRewardsEnabled: rewards?.customRewardsEnabled ?? true,
        tremendousProducts: rewards?.tremendousProducts ?? [],
      },
    };
  }

  private async getRewardsSettings(tenantId: string): Promise<RewardsSettings> {
    const { settings } = await this.getRewardsContext(tenantId);
    return settings;
  }

  private resolveCatalogCountrySelection(
    settings: RewardsSettings,
    tenantCountryCode: string | null,
    requestedCountry?: string | null,
  ): string {
    const tenantCountry = GeoLocationHelper.toStoredCountryCode(tenantCountryCode) ?? 'US';
    const allowed = normalizeRewardsCatalogCountries(settings.catalogCountries, tenantCountry);
    if (!requestedCountry?.trim()) {
      return allowed[0] ?? tenantCountry;
    }
    const selected = GeoLocationHelper.toStoredCountryCode(requestedCountry);
    if (!selected || !allowed.includes(selected)) {
      throw new BadRequestException(
        'Catalog country is not enabled for this workspace. Ask an admin to add it in Rewards settings.',
      );
    }
    return selected;
  }

  private productMatchesCatalogCountry(
    product: { countryCode?: string; countries?: string[] },
    catalogCountry: string,
  ): boolean {
    const countries =
      product.countries?.length && product.countries.length > 0
        ? product.countries
        : product.countryCode
          ? [product.countryCode]
          : [];
    return countries.some((code) => GeoLocationHelper.toStoredCountryCode(code) === catalogCountry);
  }

  private countryDisplayName(code: string): string {
    try {
      const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
      return name || code;
    } catch {
      return code;
    }
  }

  async getCatalogCountries(_tenantId: string): Promise<Array<{ code: string; name: string }>> {
    if (!this.tremendousApi.isConfigured()) {
      return [
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'NG', name: 'Nigeria' },
      ];
    }
    const products = await this.tremendousApi.listProducts();
    const codes = new Set<string>();
    for (const product of products) {
      for (const country of product.countries ?? []) {
        const code = GeoLocationHelper.toStoredCountryCode(country.abbr);
        if (code) codes.add(code);
      }
    }
    return Array.from(codes)
      .sort()
      .map((code) => ({ code, name: this.countryDisplayName(code) }));
  }

  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private deduplicateTremendousCatalog(items: CatalogItem[]): CatalogItem[] {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const key = `${this.normalizeProductName(item.name)}:${item.countryCode}`;
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }

    const deduplicated: CatalogItem[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        deduplicated.push(group[0]);
        continue;
      }
      const cheapest = group.reduce((best, item) =>
        item.pointsCost < best.pointsCost ? item : best,
      );
      deduplicated.push(cheapest);
    }
    return deduplicated;
  }

  async getCatalog(
    tenantId: string,
    options?: { includeAdminPricing?: boolean; countryCode?: string | null },
  ): Promise<CatalogItem[]> {
    let { settings, countryCode } = await this.getRewardsContext(tenantId);
    if (!settings.enabled) {
      return [];
    }

    const catalogCountry = this.resolveCatalogCountrySelection(
      settings,
      countryCode,
      options?.countryCode,
    );

    let synced = false;
    if ((settings.tremendousProducts ?? []).length === 0) {
      await this.syncTremendousProducts(tenantId);
      synced = true;
    }
    if (synced) {
      settings = (await this.getRewardsContext(tenantId)).settings;
    }

    const exchangeRate = settings.pointsExchangeRate;
    const catalog: CatalogItem[] = [];
    const tremendousItems: CatalogItem[] = [];

    const giftCardsEnabled = settings.giftCardsEnabled ?? true;
    const giftCardCategories = settings.giftCardCategories ?? [
      'Gift Cards',
      'Gaming Cards',
      'Money Cards',
    ];

    for (const p of settings.tremendousProducts ?? []) {
      if (!this.productMatchesCatalogCountry(p, catalogCountry)) continue;
      const cat = this.getTremendousCategory(p.name, p.category, p.subcategory);
      if (!giftCardsEnabled) continue;
      if (!giftCardCategories.includes(cat)) continue;

      tremendousItems.push({
        id: `tremendous_${catalogCountry}_${p.productId}`,
        name: p.name,
        type: 'TREMENDOUS',
        pointsCost: p.pointsCost,
        currencyValue: p.fixedDenominations?.[0] ?? p.minDenomination ?? 0,
        currencyCode: p.currencyCode,
        countryCode: catalogCountry,
        imageUrl: p.imageUrl,
        minDenomination: p.minDenomination ?? null,
        maxDenomination: p.maxDenomination ?? null,
        fixedDenominations: p.fixedDenominations ?? [],
        ...(options?.includeAdminPricing &&
        p.listTremendousCost != null &&
        p.listTremendousCostCurrency
          ? {
              adminPricing: {
                reloadlyCost: p.listTremendousCost,
                reloadlyCostCurrency: p.listTremendousCostCurrency,
              },
            }
          : {}),
      });
    }

    catalog.push(...this.deduplicateTremendousCatalog(tremendousItems));

    if (settings.customRewardsEnabled) {
      const customRewards = await this.customRewardsService.list(tenantId);
      for (const cr of customRewards) {
        catalog.push({
          id: `custom_${cr.id}`,
          name: cr.title,
          type: 'CUSTOM',
          pointsCost: cr.pointsCost,
          currencyValue: cr.pointsCost / exchangeRate,
          currencyCode: settings.rewardsCurrency,
          imageUrl: cr.imageUrl,
          deliveryInstructions: cr.deliveryInstructions,
          stockLimit: cr.stockLimit,
        });
      }
    }

    return catalog;
  }

  async syncCatalog(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<{ providers: Array<'tremendous'>; count: number }> {
    let count = 0;
    const products = await this.syncTremendousProducts(tenantId, options);
    count += products.length;
    return { providers: ['tremendous'], count };
  }

  async syncTremendousProducts(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<NonNullable<RewardsSettings['tremendousProducts']>> {
    const repo = this.dataSource.getRepository(TenantSettings);
    const row = await repo.findOne({ where: { tenantId } });
    if (!row) {
      return [];
    }

    const existing = row.settings?.rewards?.tremendousProducts ?? [];
    if (!options?.force && existing.length > 0) {
      return existing;
    }

    const settings = await this.getRewardsSettings(tenantId);
    if (!this.tremendousApi.isConfigured()) {
      return existing;
    }

    const products = await this.buildTremendousProductRecords(tenantId, settings);
    row.settings = {
      ...row.settings,
      rewards: {
        ...settings,
        tremendousProducts: products,
      },
    };
    await repo.save(row);
    return products;
  }

  private async buildTremendousProductRecords(
    tenantId: string,
    settings: RewardsSettings,
  ): Promise<NonNullable<RewardsSettings['tremendousProducts']>> {
    const allowlist = settings.catalogCountries ?? [];
    const products = await this.tremendousApi.listProducts(
      allowlist.length > 0 ? allowlist : undefined,
    );
    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const exchangeRate = settings.pointsExchangeRate;
    const allowlistSet = new Set(allowlist);

    const records: NonNullable<RewardsSettings['tremendousProducts']> = [];

    for (const p of products) {
      try {
        const productCountries = Array.from(
          new Set(
            (p.countries ?? [])
              .map((country) => GeoLocationHelper.toStoredCountryCode(country.abbr))
              .filter((code): code is string => Boolean(code)),
          ),
        );
        const matchingCountries =
          allowlistSet.size > 0
            ? productCountries.filter((code) => allowlistSet.has(code))
            : productCountries;
        if (matchingCountries.length === 0) {
          continue;
        }

        const denoms = this.tremendousSkusToDenoms(p.skus);
        const listCost = denoms.fixedDenominations[0] ?? denoms.minDenomination;
        if (listCost == null) {
          continue;
        }
        const currencyCode = p.currency_codes?.[0] ?? settings.rewardsCurrency;
        const imageUrl =
          p.images?.find((image) => image.type === 'card')?.src ?? p.images?.[0]?.src ?? null;

        for (const countryCode of matchingCountries) {
          const wholesaleInRewardsCurrency = await this.toWalletCurrency(
            listCost,
            currencyCode,
            settings.rewardsCurrency,
            undefined,
            countryCode,
          );
          const chargedValue = computeRedemptionDebit(wholesaleInRewardsCurrency, feePercentage);
          const pointsCost = Math.ceil(chargedValue * exchangeRate);

          records.push({
            productId: p.id,
            name: p.name,
            countryCode,
            countries: productCountries,
            currencyCode,
            imageUrl,
            minDenomination: denoms.minDenomination,
            maxDenomination: denoms.maxDenomination,
            fixedDenominations: denoms.fixedDenominations,
            pointsCost,
            listTremendousCost: listCost,
            listTremendousCostCurrency: currencyCode,
            wholesaleInRewardsCurrency,
            category: p.category,
            subcategory: p.subcategory,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Skipping Tremendous product ${p.id} (${p.name}): FX conversion failed — ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const seen = new Set<string>();
    return records.filter((record) => {
      const key = `${record.productId}:${record.countryCode}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async claim(tenantId: string, memberId: string, input: ClaimInput): Promise<RewardRedemption> {
    const settings = await this.getRewardsSettings(tenantId);
    if (!settings.enabled) {
      throw new BadRequestException('Rewards are not enabled for this workspace');
    }

    this.assertNgNombaRouting(input, settings);

    const currencyCode = input.currencyCode ?? settings.rewardsCurrency;
    const currencyValue = input.currencyValue;
    const pointsCost = input.pointsCost;
    const redemptionId = this.resolveRedemptionId(input);
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const existing = await redemptionRepo.findOne({
      where: { id: redemptionId, tenantId, memberId },
    });

    if (existing) {
      this.assertMatchingIdempotentClaim(existing, input);
      if (existing.status === 'SUCCESS' || existing.status === 'FAILED') {
        return existing;
      }
    }

    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const costs = await this.computeClaimCosts(
      tenantId,
      settings,
      input,
      pointsCost,
      currencyValue,
      feePercentage,
    );

    if (input.rewardType !== 'CUSTOM' && pointsCost !== costs.expectedPointsCost) {
      throw new BadRequestException(
        `Invalid points cost. Expected ${costs.expectedPointsCost} points for this reward.`,
      );
    }

    if (existing?.status === 'PENDING') {
      let originalDebitAmount = costs.totalTenantDebit;

      const claimed = await this.dataSource.transaction(async (manager) => {
        const updateResult = await manager
          .getRepository(RewardRedemption)
          .createQueryBuilder()
          .update(RewardRedemption)
          .set({
            status: 'PROCESSING' as RedemptionStatus,
            processingStartedAt: () => 'NOW()',
          })
          .where(
            'id = :id AND tenant_id = :tenantId AND member_id = :memberId AND status = :status',
            {
              id: redemptionId,
              tenantId,
              memberId,
              status: 'PENDING',
            },
          )
          .execute();

        if (!updateResult.affected) {
          return null;
        }

        const walletTxRepo = manager.getRepository(TenantWalletTransaction);
        const originalDebit = await walletTxRepo.findOne({
          where: { reference: redemptionId, type: 'SPENT' },
        });
        if (originalDebit) {
          originalDebitAmount = Math.abs(Number(originalDebit.amount));
        }

        return true;
      });

      if (!claimed) {
        return this.dataSource.getRepository(RewardRedemption).findOneOrFail({
          where: { id: redemptionId, tenantId, memberId },
        });
      }

      const updated = await this.dataSource.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemptionId, tenantId, memberId },
      });

      return this.finalizeClaimFulfillment({
        tenantId,
        memberId,
        input,
        redemption: updated,
        pointsCost,
        totalTenantDebit: originalDebitAmount,
      });
    }

    if (existing?.status === 'PROCESSING') {
      const leaseExpired =
        existing.processingStartedAt &&
        Date.now() - existing.processingStartedAt.getTime() > PROCESSING_LEASE_MS;

      if (!leaseExpired) {
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      }

      this.logger.warn(
        `Recovering stale PROCESSING redemption ${redemptionId} (lease expired at ${existing.processingStartedAt?.toISOString()})`,
      );

      await this.dataSource.getRepository(RewardRedemption).update(redemptionId, {
        status: 'PENDING' as RedemptionStatus,
        processingStartedAt: null,
      });

      return this.claim(tenantId, memberId, input);
    }

    let redemption: RewardRedemption;
    await this.dataSource.transaction(async (manager) => {
      const pending = await manager.getRepository(RewardRedemption).findOne({
        where: { id: redemptionId, tenantId, memberId },
      });
      if (pending) {
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      }

      if (input.rewardType === 'CUSTOM') {
        const customRewardRepo = manager.getRepository(CustomReward);
        const cr = await customRewardRepo.findOneOrFail({
          where: { id: input.rewardId, tenantId },
        });
        if (!cr.isActive) {
          throw new BadRequestException('This custom reward is currently inactive');
        }
        if (pointsCost !== cr.pointsCost) {
          throw new BadRequestException(`Invalid points cost for custom reward: ${cr.pointsCost}`);
        }
        if (cr.stockLimit !== null) {
          if (cr.stockLimit <= 0) {
            throw new BadRequestException('Reward is out of stock');
          }
          await customRewardRepo.update(cr.id, {
            stockLimit: cr.stockLimit - 1,
          });
        }
      }

      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const memberPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!memberPoints || memberPoints.currentBalance < pointsCost) {
        throw new BadRequestException(
          `Insufficient points. You need ${pointsCost} points but have ${memberPoints?.currentBalance ?? 0}.`,
        );
      }

      const updateResult = await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => 'current_balance - :pointsCost' })
        .where(
          'tenant_id = :tenantId AND member_id = :memberId AND current_balance >= :pointsCost',
          {
            tenantId,
            memberId,
            pointsCost,
          },
        )
        .execute();

      if (!updateResult.affected) {
        throw new BadRequestException('Insufficient points or transaction conflict.');
      }

      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
      const pointsTx = txRepo.create({
        tenantId,
        memberId,
        type: ShoutoutPointTransactionType.REDEMPTION,
        points: -pointsCost,
        runningBalance: updatedPoints.currentBalance,
        description: `Redeemed for: ${input.rewardName ?? input.rewardId}`,
        createdBy: memberId,
      });
      await txRepo.save(pointsTx);

      if (input.rewardType !== 'CUSTOM') {
        await this.walletService.debit(
          tenantId,
          costs.totalTenantDebit,
          redemptionId,
          `Reward claim: ${input.rewardName ?? input.rewardId} (Face Value: ${currencyCode} ${currencyValue}, Platform Fees: ${Number((costs.totalTenantDebit - costs.faceValueInRewardsCurrency).toFixed(2))})`,
          memberId,
          manager,
        );
      }

      const txRedemptionRepo = manager.getRepository(RewardRedemption);
      redemption = txRedemptionRepo.create({
        id: redemptionId,
        tenantId,
        memberId,
        rewardType: input.rewardType,
        rewardId: input.rewardId,
        rewardName: input.rewardName,
        pointsSpent: pointsCost,
        currencyValue,
        currencyCode,
        status: 'PENDING' as RedemptionStatus,
        recipient: {
          email: input.recipientEmail ?? undefined,
          phone: input.recipientPhone ?? undefined,
        },
      });
      await txRedemptionRepo.save(redemption);
    });

    if (input.rewardType !== 'CUSTOM') {
      try {
        await this.walletTopupService.maybeAutoTopupAfterDebit(tenantId, memberId);
      } catch (error) {
        this.logger.warn(
          `Auto top-up after redemption failed for tenant ${tenantId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return this.finalizeClaimFulfillment({
      tenantId,
      memberId,
      input,
      redemption: redemption!,
      pointsCost,
      totalTenantDebit: costs.totalTenantDebit,
    });
  }

  private resolveRedemptionId(input: ClaimInput): string {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      return randomUUID();
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      throw new BadRequestException('idempotencyKey must be a valid UUID');
    }
    return key;
  }

  private assertMatchingIdempotentClaim(existing: RewardRedemption, input: ClaimInput): void {
    const existingEmail = existing.recipient?.email ?? null;
    const existingPhone = existing.recipient?.phone ?? null;
    if (
      existing.rewardType !== input.rewardType ||
      existing.rewardId !== input.rewardId ||
      existing.pointsSpent !== input.pointsCost ||
      Number(existing.currencyValue) !== input.currencyValue ||
      existingEmail !== (input.recipientEmail ?? null) ||
      existingPhone !== (input.recipientPhone ?? null)
    ) {
      throw new BadRequestException(
        'This idempotency key was already used for a different reward claim.',
      );
    }
  }

  private async computeClaimCosts(
    tenantId: string,
    settings: RewardsSettings,
    input: ClaimInput,
    pointsCost: number,
    currencyValue: number,
    feePercentage: number,
  ): Promise<ClaimCostBreakdown> {
    if (input.rewardType === 'NOMBA_AIRTIME' || input.rewardType === 'NOMBA_UTILITY') {
      const calc = await this.calculateLocalRewardCost(tenantId, currencyValue);
      return {
        totalTenantDebit: calc.totalTenantDebit,
        expectedPointsCost: calc.pointsCost,
        faceValueInRewardsCurrency: calc.currencyValue,
      };
    }

    if (input.rewardType === 'TREMENDOUS') {
      const product = this.resolveTremendousProduct(settings, input.rewardId);
      if (!product) {
        throw new BadRequestException('Tremendous product not found in catalog');
      }

      let wholesaleInRewardsCurrency = product.wholesaleInRewardsCurrency;
      if (wholesaleInRewardsCurrency == null) {
        if (product.listTremendousCost == null || !product.listTremendousCostCurrency) {
          throw new BadRequestException(
            'Gift card pricing is not available. Please refresh the rewards catalog.',
          );
        }
        wholesaleInRewardsCurrency = await this.toWalletCurrency(
          product.listTremendousCost,
          product.listTremendousCostCurrency,
          settings.rewardsCurrency,
          undefined,
          product.countryCode,
        );
      }

      return {
        faceValueInRewardsCurrency: wholesaleInRewardsCurrency,
        totalTenantDebit: computeRedemptionDebit(wholesaleInRewardsCurrency, feePercentage),
        expectedPointsCost: product.pointsCost,
      };
    }

    if (input.rewardType === 'CUSTOM') {
      return {
        totalTenantDebit: currencyValue,
        faceValueInRewardsCurrency: currencyValue,
        expectedPointsCost: pointsCost,
      };
    }

    throw new BadRequestException(`Unsupported reward type: ${input.rewardType}`);
  }

  private async finalizeClaimFulfillment(params: {
    tenantId: string;
    memberId: string;
    input: ClaimInput;
    redemption: RewardRedemption;
    pointsCost: number;
    totalTenantDebit: number;
  }): Promise<RewardRedemption> {
    const { tenantId, memberId, input, pointsCost, totalTenantDebit } = params;
    let redemption = params.redemption;
    const redemptionId = redemption.id;

    try {
      await this.runClaimFulfillment(redemption, input);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fulfillment error';
      this.logger.error(`Reward fulfillment failed for ${redemptionId}: ${errorMessage}`);

      const alreadyFailed = await this.dataSource.getRepository(RewardRedemption).findOne({
        where: { id: redemptionId, status: 'FAILED' as RedemptionStatus },
      });
      if (alreadyFailed) {
        redemption = alreadyFailed;
        return redemption;
      }

      let originalDebitAmount = totalTenantDebit;
      const originalDebit = await this.dataSource
        .getRepository(TenantWalletTransaction)
        .findOne({ where: { reference: redemptionId, type: 'SPENT' } });
      if (originalDebit) {
        originalDebitAmount = Math.abs(Number(originalDebit.amount));
      }

      // Refund points + wallet + stock and mark FAILED atomically. The
      // conditional status flip is the idempotency guard: only the executor
      // that flips this redemption to FAILED performs the refunds, so an
      // overlapping provider webhook or a retry after a stopped execution
      // cannot double-refund. A failure mid-refund rolls everything back, so
      // the redemption never ends up FAILED with a partial refund.
      await this.dataSource.transaction(async (manager) => {
        const flip = await manager
          .getRepository(RewardRedemption)
          .createQueryBuilder()
          .update(RewardRedemption)
          .set({
            status: 'FAILED' as RedemptionStatus,
            providerRef: { ...redemption.providerRef, error: errorMessage },
            processingStartedAt: null,
          })
          .where(
            'id = :redemptionId AND tenant_id = :tenantId AND member_id = :memberId AND status <> :failed',
            {
              redemptionId,
              tenantId,
              memberId,
              failed: 'FAILED' as RedemptionStatus,
            },
          )
          .execute();

        if (!flip.affected) {
          return;
        }

        // Refund member points
        const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
        await pointsRepo
          .createQueryBuilder()
          .update(ShoutoutMemberPoints)
          .set({ currentBalance: () => 'current_balance + :pointsCost' })
          .where('tenant_id = :tenantId AND member_id = :memberId', {
            tenantId,
            memberId,
            pointsCost,
          })
          .execute();

        const txRepo = manager.getRepository(ShoutoutPointTransaction);
        const updatedPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
        if (updatedPoints) {
          const refundTx = txRepo.create({
            tenantId,
            memberId,
            type: ShoutoutPointTransactionType.REDEMPTION,
            points: pointsCost,
            runningBalance: updatedPoints.currentBalance,
            description: `Refund: ${input.rewardName ?? input.rewardId} — ${errorMessage}`,
            createdBy: memberId,
          });
          await txRepo.save(refundTx);
        }

        // Refund wallet — keep the existing-refund check as defence-in-depth
        // for partial states written by older code.
        if (input.rewardType !== 'CUSTOM') {
          const walletRepo = manager.getRepository(TenantWallet);
          const wallet = await walletRepo
            .createQueryBuilder('w')
            .setLock('pessimistic_write')
            .where('w.tenant_id = :tenantId', { tenantId })
            .getOne();

          if (wallet) {
            const existingRefund = await manager
              .getRepository(TenantWalletTransaction)
              .findOne({ where: { reference: `refund:${redemptionId}`, type: 'REFUND' } });

            if (existingRefund) {
              this.logger.log(
                `Wallet refund for ${redemptionId} already exists, skipping duplicate`,
              );
            } else {
              await manager
                .getRepository(TenantWallet)
                .createQueryBuilder()
                .update(TenantWallet)
                .set({ balanceAmount: () => 'balance_amount + :amount' })
                .where('tenant_id = :tenantId', { tenantId, amount: originalDebitAmount })
                .execute();

              const refundTx = manager.getRepository(TenantWalletTransaction).create({
                tenantWalletId: wallet.id,
                type: 'REFUND',
                amount: originalDebitAmount,
                reference: `refund:${redemptionId}`,
                description: `Refund: ${input.rewardName ?? input.rewardId}`,
                status: 'COMPLETED',
                rawAmount: originalDebitAmount,
                metadata: { actorMemberId: memberId },
              });
              await manager.getRepository(TenantWalletTransaction).save(refundTx);
            }
          }
        }

        // Restore custom reward stock
        if (input.rewardType === 'CUSTOM') {
          const cr = await manager
            .getRepository(CustomReward)
            .findOne({ where: { id: input.rewardId, tenantId } });
          if (cr && cr.stockLimit !== null) {
            await manager.getRepository(CustomReward).update(cr.id, {
              stockLimit: cr.stockLimit + 1,
            });
          }
        }
      });

      redemption = await this.dataSource.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemptionId, tenantId, memberId },
      });
      return redemption;
    }

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'reward.redeemed',
        resourceType: 'reward',
        resourceId: redemptionId,
        description: `${input.rewardName ?? input.rewardId} redeemed`,
        metadata: {
          rewardName: input.rewardName ?? input.rewardId,
          pointsCost,
          rewardType: input.rewardType,
        },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to queue reward redemption activity: ${err instanceof Error ? err.message : err}`,
        );
      });

    return this.dataSource.getRepository(RewardRedemption).findOneOrFail({
      where: { id: redemptionId, tenantId, memberId },
    });
  }

  private async runClaimFulfillment(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (input.rewardType === 'TREMENDOUS') {
      await this.fulfillTremendous(redemption, input);
      return;
    }
    if (input.rewardType === 'NOMBA_AIRTIME') {
      await this.fulfillNombaTopup(redemption, input);
      return;
    }
    if (input.rewardType === 'NOMBA_UTILITY') {
      await this.fulfillNombaUtility(redemption, input);
      return;
    }
    if (input.rewardType === 'CUSTOM') {
      await this.fulfillCustom(redemption);
    }
  }

  private async fulfillTremendous(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    const productId = this.extractTremendousProductId(input.rewardId);
    if (!productId) {
      throw new Error('Missing Tremendous productId for gift card order');
    }

    const member = await this.dataSource
      .getRepository(TenantMember)
      .createQueryBuilder('m')
      .leftJoin('m.user', 'u')
      .select(['m.id', 'm.firstName', 'm.lastName', 'm.preferredName', 'u.id', 'u.email'])
      .where('m.id = :id AND m.tenantId = :tenantId', {
        id: redemption.memberId,
        tenantId: redemption.tenantId,
      })
      .getOne();

    const recipientEmail = redemption.recipient?.email ?? member?.user?.email;
    if (!recipientEmail) {
      throw new Error('Recipient email is required to issue a Tremendous reward');
    }

    const recipientName =
      member?.preferredName?.trim() ||
      `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() ||
      'Member';

    const orderResponse = await this.tremendousApi.createOrder({
      productId,
      denomination: Number(redemption.currencyValue),
      currencyCode: redemption.currencyCode,
      recipientName,
      recipientEmail,
      externalId: redemption.id,
    });

    const orderStatus = orderResponse.order?.status;
    const reward = orderResponse.reward ?? orderResponse.order?.rewards?.[0];
    const deliveryStatus = reward?.delivery?.status;
    const deliveryLink = reward?.delivery?.link ?? null;
    const orderId = orderResponse.order?.id ?? reward?.id ?? null;

    if (
      orderStatus === 'DECLINED' ||
      orderStatus === 'CANCELLED' ||
      deliveryStatus === 'FAILED' ||
      deliveryStatus === 'BOUNCED'
    ) {
      throw new Error(
        `Tremendous order was not fulfilled: ${orderStatus ?? deliveryStatus ?? 'unknown status'}`,
      );
    }

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: orderId ?? undefined },
      voucher: {
        code: deliveryLink ?? undefined,
        instructions: deliveryLink
          ? 'Open this link to choose and redeem your gift card.'
          : 'Your reward is being prepared. Check back shortly for your redemption link.',
      },
      processingStartedAt: null,
    });

    if (deliveryLink) {
      void this.sendRewardClaimEmail({
        recipientEmail,
        recipientName,
        redemption,
        deliveryLink,
      }).catch((err) => {
        this.logger.warn(
          `Failed to send reward claim email for ${redemption.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }
  }

  private async sendRewardClaimEmail(params: {
    recipientEmail: string;
    recipientName: string;
    redemption: RewardRedemption;
    deliveryLink: string;
  }): Promise<void> {
    const { recipientEmail, recipientName, redemption, deliveryLink } = params;

    const rendered = this.emailTemplateService.render('reward-claim', {
      employeeName: recipientName,
      employeeEmail: recipientEmail,
      rewardName: redemption.rewardName ?? 'Gift Card',
      rewardAmount: redemption.currencyValue,
      currencyCode: redemption.currencyCode,
      redemptionUrl: deliveryLink,
      referenceId: redemption.id,
      providerName: 'Tremendous',
      providerLogoUrl: 'https://www.tremendous.com/img/tremendous-logo.png',
    });

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private async fulfillNombaTopup(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    if (!input.recipientPhone || !input.airtimeNetwork) {
      throw new Error('Phone number and network are required for mobile top-up');
    }

    const isData = input.topupKind === 'data';
    const useMonnify = this.useMonnifyNgBills();

    let result: { success: boolean; transactionId: string | null; status: string };
    if (useMonnify) {
      const purchaseInput = {
        amount: redemption.currencyValue,
        phoneNumber: input.recipientPhone,
        network: input.airtimeNetwork,
        merchantTxRef: redemption.id,
      };
      result = isData
        ? await this.monnifyBillApi.purchaseDataBundle(purchaseInput)
        : await this.monnifyBillApi.purchaseAirtime(purchaseInput);
    } else {
      const senderName = await this.resolveSenderName(redemption.tenantId);
      const purchaseInput = {
        amount: redemption.currencyValue,
        phoneNumber: input.recipientPhone,
        network: input.airtimeNetwork,
        merchantTxRef: redemption.id,
        senderName,
      };
      result = isData
        ? await this.nombaBillApi.purchaseDataBundle(purchaseInput)
        : await this.nombaBillApi.purchaseAirtime(purchaseInput);
    }

    if (!result.success) {
      throw new Error(
        `${isData ? 'Data bundle' : 'Airtime'} purchase failed: status ${result.status}`,
      );
    }

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: {
        instructions: isData
          ? `Data bundle of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`
          : `Airtime of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`,
      },
      processingStartedAt: null,
    });
  }

  private async fulfillNombaUtility(
    redemption: RewardRedemption,
    input: ClaimInput,
  ): Promise<void> {
    if (!input.accountNumber || !input.billerId || !input.serviceType) {
      throw new Error('Meter number, biller ID, and service type are required for utility payment');
    }

    const purchaseInput = {
      amount: redemption.currencyValue,
      meterNumber: input.accountNumber,
      billerId: String(input.billerId),
      serviceType: input.serviceType as 'PREPAID' | 'POSTPAID',
      merchantTxRef: redemption.id,
    };

    const result = this.useMonnifyNgBills()
      ? await this.monnifyBillApi.purchaseElectricity(purchaseInput)
      : await this.nombaBillApi.purchaseElectricity(purchaseInput);

    if (!result.success) {
      throw new Error(`Electricity purchase failed: status ${result.status}`);
    }

    const instructions = result.token
      ? `Utility payment successful. Prepaid token: ${result.token}`
      : `Utility payment successful. Reference: ${result.transactionId}`;

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: { code: result.token || undefined, instructions },
      processingStartedAt: null,
    });
  }

  private async fulfillCustom(redemption: RewardRedemption): Promise<void> {
    const customReward = await this.dataSource.getRepository(CustomReward).findOne({
      where: { id: redemption.rewardId ?? undefined },
    });

    await this.dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      voucher: {
        instructions:
          customReward?.deliveryInstructions ??
          'Your admin has been notified and will fulfill this reward.',
      },
      processingStartedAt: null,
    });
  }

  async getMyClaims(tenantId: string, memberId: string): Promise<RewardRedemption[]> {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId, memberId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getAllClaims(tenantId: string): Promise<RewardRedemption[]> {
    return this.dataSource.getRepository(RewardRedemption).find({
      where: { tenantId },
      relations: ['member'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listTasks(tenantId: string, memberId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const tasks = await taskRepo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      const defaultTasksData: Array<{
        title: string;
        description: string;
        points: number;
        icon: string;
        category?: string;
        imageUrl?: string;
        submissionType: 'instant' | 'text' | 'file';
        isRecurring: boolean;
      }> = [
        {
          title: 'Welcome Tour',
          description: 'Take a quick 2-minute tour of the workspace and navigation.',
          points: 10,
          icon: 'Compass',
          category: 'Onboarding',
          imageUrl:
            'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
          isRecurring: false,
        },
        {
          title: 'Profile Picture Check',
          description: 'Upload your avatar so your teammates can easily recognize you.',
          points: 25,
          icon: 'User',
          category: 'Profile',
          imageUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
          isRecurring: false,
        },
        {
          title: 'Spread Appreciation',
          description: 'Recognize a colleague by writing and sending your first shoutout.',
          points: 15,
          icon: 'Heart',
          category: 'Culture',
          imageUrl:
            'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'instant',
          isRecurring: false,
        },
        {
          title: 'Daily 10k Steps Challenge',
          description: 'Take 10,000 steps today and upload a screenshot of your tracker.',
          points: 20,
          icon: 'Activity',
          category: 'Health',
          imageUrl:
            'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=150&auto=format&fit=crop&q=60',
          submissionType: 'file',
          isRecurring: true,
        },
        {
          title: 'Share Feedback',
          description: 'Submit your text feedback on what we can improve in this workspace.',
          points: 15,
          icon: 'MessageSquare',
          category: 'Culture',
          imageUrl:
            'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=150&auto=format&fit=crop&q=60',
          submissionType: 'text',
          isRecurring: true,
        },
      ];

      for (const d of defaultTasksData) {
        const t = taskRepo.create({
          tenantId,
          ...d,
        });
        await taskRepo.save(t);
      }

      return this.listTasks(tenantId, memberId);
    }

    const submissions = await submissionRepo.find({
      where: { tenantId, memberId },
    });

    return tasks.map((task) => {
      // Find all submissions for this task, sorted by updatedAt descending
      const taskSubs = submissions
        .filter((s) => s.taskId === task.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const latestSub = taskSubs[0];

      let completed = false;
      let status: 'available' | 'pending' | 'completed' | 'rejected' = 'available';

      if (latestSub) {
        if (latestSub.status === 'completed') {
          if (task.isRecurring) {
            status = 'available';
          } else {
            status = 'completed';
            completed = true;
          }
        } else if (latestSub.status === 'pending') {
          status = 'pending';
        } else if (latestSub.status === 'rejected') {
          status = 'available';
        }
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        icon: task.icon,
        category: task.category,
        imageUrl: task.imageUrl,
        submissionType: task.submissionType,
        isRecurring: task.isRecurring,
        completed,
        status,
        submissionText: latestSub?.submissionText,
        submissionFileName: latestSub?.submissionFileName,
        submissionId: latestSub?.id,
      };
    });
  }

  /**
   * Returns whether the given actor is allowed to approve/reject a submission
   * made by `submitterMemberId`.
   *
   * Rules:
   *  - admin/owner: always allowed
   *  - manager (reportsToId on the submitter's current active employment): allowed
   *  - actor === submitter: never allowed
   */
  private async canActorApproveFor(
    tenantId: string,
    actorId: string,
    submitterMemberId: string,
  ): Promise<boolean> {
    // Can never approve your own submission
    if (actorId === submitterMemberId) return false;

    const memberRepo = this.dataSource.getRepository(TenantMember);
    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    if (!actor) return false;

    const role = actor.role?.toLowerCase();
    if (role === 'admin' || role === 'owner') return true;

    // Check if actor is the line manager of the submitter via Employment.reportsToId
    const employmentRepo = this.dataSource.getRepository(Employment);
    const submitterEmployment = await employmentRepo.findOne({
      where: { tenantMemberId: submitterMemberId, tenantId },
      order: { startDate: 'DESC' },
    });

    if (submitterEmployment?.reportsToId === actorId) return true;

    return false;
  }

  async listPendingSubmissions(tenantId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);
    const taskRepo = this.dataSource.getRepository(Task);
    const memberRepo = this.dataSource.getRepository(TenantMember);

    // Determine if actor is admin/owner
    const actor = await memberRepo.findOne({ where: { id: actorId, tenantId } });
    const role = actor?.role?.toLowerCase();
    const isAdminOrOwner = role === 'admin' || role === 'owner';

    const submissions = await submissionRepo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (submissions.length === 0) return [];

    const tasks = await taskRepo.find({ where: { tenantId } });

    // For non-admin/owner, filter to only submissions the actor manages
    const employmentRepo = this.dataSource.getRepository(Employment);
    let manageableSubmitterIds: Set<string> | null = null;
    if (!isAdminOrOwner) {
      const subordinates = await employmentRepo.find({
        where: { reportsToId: actorId, tenantId },
        select: ['tenantMemberId'],
      });
      manageableSubmitterIds = new Set(subordinates.map((e) => e.tenantMemberId));
    }

    const visibleSubmissions = submissions.filter((sub) => {
      // Never show your own submissions in the approval queue
      if (sub.memberId === actorId) return false;
      // Admins/owners see all
      if (isAdminOrOwner) return true;
      // Managers see only their direct reports
      return manageableSubmitterIds!.has(sub.memberId);
    });

    // Fetch submitter member info
    const submitterIds = [...new Set(visibleSubmissions.map((s) => s.memberId))];
    const members = submitterIds.length ? await memberRepo.findByIds(submitterIds) : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));

    return visibleSubmissions.map((sub) => {
      const task = tasks.find((t) => t.id === sub.taskId);
      const member = memberMap.get(sub.memberId);
      return {
        id: task?.id ?? sub.taskId,
        submissionId: sub.id,
        title: task?.title ?? 'Unknown Task',
        description: task?.description ?? '',
        points: task?.points ?? 0,
        icon: task?.icon ?? 'Sparkles',
        category: task?.category,
        imageUrl: task?.imageUrl,
        submissionType: task?.submissionType ?? 'instant',
        status: sub.status,
        submissionText: sub.submissionText,
        submissionFileName: sub.submissionFileName,
        memberId: sub.memberId,
        member: member ? { firstName: member.firstName, lastName: member.lastName } : undefined,
      };
    });
  }

  async createTask(
    tenantId: string,
    data: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    actorMemberId?: string,
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = taskRepo.create({
      tenantId,
      title: data.title,
      description: data.description,
      points: data.points,
      icon: data.icon,
      category: data.category ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      submissionType: data.submissionType,
      isRecurring: data.isRecurring ?? false,
    });
    const saved = await taskRepo.save(task);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.task_created',
          resourceType: 'task',
          resourceId: saved.id,
          description: `Task "${data.title}" created`,
          metadata: { title: data.title, points: data.points },
        })
        .catch(() => {});
    }
    return saved;
  }

  async deleteTask(tenantId: string, taskId: string, actorMemberId?: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    await taskRepo.remove(task);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.task_deleted',
          resourceType: 'task',
          resourceId: taskId,
          description: `Task "${task.title}" deleted`,
          metadata: { title: task.title },
        })
        .catch(() => {});
    }
    return { success: true };
  }

  async submitTask(
    tenantId: string,
    taskId: string,
    memberId: string,
    data: {
      submissionText?: string;
      submissionFileName?: string;
    },
  ) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    let sub = await submissionRepo.findOne({ where: { taskId, memberId, tenantId } });
    if (sub && sub.status === 'completed') {
      throw new BadRequestException('Task already completed');
    }

    const isInstant = task.submissionType === 'instant';
    const status: 'pending' | 'completed' | 'rejected' = isInstant ? 'completed' : 'pending';

    if (!sub) {
      sub = submissionRepo.create({
        tenantId,
        taskId,
        memberId,
        status,
        submissionText: data.submissionText ?? undefined,
        submissionFileName: data.submissionFileName ?? undefined,
      });
    } else {
      sub.status = status;
      sub.submissionText = data.submissionText ?? sub.submissionText;
      sub.submissionFileName = data.submissionFileName ?? sub.submissionFileName;
    }

    await submissionRepo.save(sub!);

    if (isInstant) {
      await this.awardPointsForTask(tenantId, memberId, task.points, task.title);
    }

    return {
      success: true,
      status,
      pointsAwarded: isInstant ? task.points : 0,
    };
  }

  async approveSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const taskRepo = this.dataSource.getRepository(Task);
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }
    if (sub.status === 'completed') {
      throw new BadRequestException('Submission already approved');
    }

    // Self-approval guard
    if (actorId === sub.memberId) {
      throw new BadRequestException('You cannot approve your own task submission');
    }

    // Permission check: admin/owner or manager of the submitter
    const canApprove = await this.canActorApproveFor(tenantId, actorId, sub.memberId);
    if (!canApprove) {
      throw new BadRequestException(
        'You do not have permission to approve this submission. Only admins, owners, or the direct manager of the employee can approve.',
      );
    }

    const task = await taskRepo.findOne({ where: { id: taskId, tenantId } });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    sub.status = 'completed';
    await submissionRepo.save(sub);

    await this.awardPointsForTask(tenantId, sub.memberId, task.points, task.title);

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: actorId,
        action: 'reward.submission_approved',
        resourceType: 'task_submission',
        resourceId: submissionId,
        description: `Task submission approved for "${task.title}"`,
        metadata: { taskId, submitterMemberId: sub.memberId, points: task.points },
      })
      .catch(() => {});

    return { success: true };
  }

  async rejectSubmission(tenantId: string, taskId: string, submissionId: string, actorId: string) {
    const submissionRepo = this.dataSource.getRepository(TaskSubmission);

    const sub = await submissionRepo.findOne({ where: { id: submissionId, tenantId, taskId } });
    if (!sub) {
      throw new BadRequestException('Submission not found');
    }

    // Self-rejection guard
    if (actorId === sub.memberId) {
      throw new BadRequestException('You cannot reject your own task submission');
    }

    // Permission check
    const canApprove = await this.canActorApproveFor(tenantId, actorId, sub.memberId);
    if (!canApprove) {
      throw new BadRequestException('You do not have permission to reject this submission.');
    }

    sub.status = 'rejected';
    await submissionRepo.save(sub);

    const task = await this.dataSource
      .getRepository(Task)
      .findOne({ where: { id: taskId, tenantId } });

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: actorId,
        action: 'reward.submission_rejected',
        resourceType: 'task_submission',
        resourceId: submissionId,
        description: `Task submission rejected for "${task?.title ?? taskId}"`,
        metadata: { taskId, submitterMemberId: sub.memberId },
      })
      .catch(() => {});

    return { success: true };
  }

  private async awardPointsForTask(
    tenantId: string,
    memberId: string,
    points: number,
    taskTitle: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const shoutoutRepo = manager.getRepository(Shoutout);

      let row = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!row) {
        row = pointsRepo.create({
          tenantId,
          memberId,
          currentBalance: 0,
          totalEarned: 0,
          lastResetDate: new Date(),
        });
      }

      row.currentBalance += points;
      row.totalEarned += points;
      await manager.save(row);

      await txRepo.save(
        txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.ADMIN_ASSIGN, // Treat task points as admin assigned/checklist grant
          points,
          runningBalance: row.currentBalance,
          description: `Completed task: ${taskTitle}`,
          createdBy: memberId,
        }),
      );

      // Create a shoutout feed entry so it shows up in the public activity feed
      await shoutoutRepo.save(
        shoutoutRepo.create({
          tenantId,
          totalPoints: points,
          createdBy: memberId,
          message: `completed task: ${taskTitle}`,
        }),
      );
    });
  }

  async getProviderAvailability() {
    return {
      tremendous: {
        giftCards: this.tremendousApi.isConfigured(),
      },
      nomba: {
        airtime: this.nombaBillApi.isConfigured(),
        utility: this.nombaBillApi.isConfigured(),
      },
      monnify: {
        airtime: this.monnifyBillApi.isConfigured(),
        utility: this.monnifyBillApi.isConfigured(),
      },
    };
  }

  async listUtilityBillers(countryCode: string) {
    if (countryCode.toUpperCase() === 'NG') {
      if (this.useMonnifyNgBills()) {
        if (!this.monnifyBillApi.isConfigured()) {
          throw new BadRequestException('Utility billers are temporarily unavailable.');
        }
        return this.monnifyBillApi.listElectricityBillers();
      }
      return [
        { id: 'EKEDC', name: 'Eko Electricity (EKEDC)' },
        { id: 'IKEDC', name: 'Ikeja Electricity (IKEDC)' },
        { id: 'AEDC', name: 'Abuja Electricity (AEDC)' },
        { id: 'IBEDC', name: 'Ibadan Electricity (IBEDC)' },
        { id: 'PHEDC', name: 'Port Harcourt Electricity (PHEDC)' },
        { id: 'KEDCO', name: 'Kano Electricity (KEDCO)' },
        { id: 'JED', name: 'Jos Electricity (JED)' },
        { id: 'EEDC', name: 'Enugu Electricity (EEDC)' },
        { id: 'KAEDCO', name: 'Kaduna Electricity (KAEDCO)' },
        { id: 'BEDC', name: 'Benin Electricity (BEDC)' },
        { id: 'YEDC', name: 'Yola Electricity (YEDC)' },
      ];
    }
    return [];
  }

  async lookupUtilityMeter(
    countryCode: string,
    billerId: string,
    accountNumber: string,
    serviceType?: string,
  ) {
    if (countryCode.toUpperCase() === 'NG') {
      const service = (serviceType || 'PREPAID') as 'PREPAID' | 'POSTPAID';
      if (this.useMonnifyNgBills()) {
        return this.monnifyBillApi.lookupElectricity(billerId, accountNumber, service);
      }
      return this.nombaBillApi.lookupElectricity(billerId, accountNumber, service);
    }
    return {
      customerName: 'Verified Account',
      meterNumber: accountNumber,
      address: null,
      billerId,
    };
  }

  async calculateLocalRewardCost(
    tenantId: string,
    amount: number,
  ): Promise<{
    pointsCost: number;
    currencyValue: number;
    currencyCode: string;
    totalTenantDebit: number;
    processingFee: number;
  }> {
    const settings = await this.getRewardsSettings(tenantId);
    const { feePercentage } = await this.getSubscriptionFees(tenantId, settings.rewardsCurrency);
    const totalTenantDebit = computeRedemptionDebit(amount, feePercentage);
    const pointsCost = Math.ceil(totalTenantDebit * settings.pointsExchangeRate);

    return {
      pointsCost,
      currencyValue: amount,
      currencyCode: settings.rewardsCurrency,
      totalTenantDebit,
      processingFee: Number((totalTenantDebit - amount).toFixed(2)),
    };
  }

  async calculatePointsCost(
    tenantId: string,
    type: 'airtime' | 'utility' | 'ng-airtime' | 'ng-utility',
    _billerId: number,
    amount: number,
  ) {
    if (type === 'ng-airtime' || type === 'ng-utility') {
      return this.calculateLocalRewardCost(tenantId, amount);
    }
    throw new BadRequestException('Global airtime and utility rewards are not available.');
  }
}
