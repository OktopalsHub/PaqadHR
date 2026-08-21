import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import {
  normalizeRewardsCatalogCountries,
  resolveGiftCardProviderFromEnv,
  resolveInitialWalletCurrency,
} from 'src/common/utils/rewards-defaults.util';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { CustomRewardsService } from './custom-rewards.service';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';
import type { CatalogItem } from '../interfaces/rewards.interface';

@Injectable()
export class RewardsCatalogService {
  private readonly logger = new Logger(RewardsCatalogService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tremendousApi: TremendousApiService,
    private readonly fiatExchange: FiatExchangeService,
    private readonly customRewardsService: CustomRewardsService,
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

  async getRewardsContext(tenantId: string): Promise<{
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
      return allowed[0] ?? tenantCountry;
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

  async getCatalogCountries(tenantId: string): Promise<Array<{ code: string; name: string }>> {
    const { settings } = await this.getRewardsContext(tenantId);
    const allowed = new Set(
      normalizeRewardsCatalogCountries(settings.catalogCountries, 'NG').map((c) => c.toUpperCase()),
    );

    if (!this.tremendousApi.isConfigured()) {
      return [
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'NG', name: 'Nigeria' },
      ].filter((c) => allowed.size === 0 || allowed.has(c.code));
    }
    const products = await this.tremendousApi.listProducts();
    const codes = new Set<string>();
    for (const product of products) {
      for (const country of product.countries ?? []) {
        const code = GeoLocationHelper.toStoredCountryCode(country.abbr);
        if (code && (allowed.size === 0 || allowed.has(code.toUpperCase()))) {
          codes.add(code);
        }
      }
    }
    return Array.from(codes)
      .sort()
      .map((code) => ({ code, name: this.countryDisplayName(code) }));
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

    const { settings } = await this.getRewardsContext(tenantId);
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
    const { feePercentage } = await this.feeService.getSubscriptionFees(tenantId, settings.rewardsCurrency);
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

  extractTremendousProductId(rewardId: string): string | undefined {
    if (!rewardId.startsWith('tremendous_')) return undefined;
    const rest = rewardId.slice('tremendous_'.length);
    const withCountry = rest.match(/^([A-Z]{2})_(.+)$/);
    return withCountry ? withCountry[2] : rest || undefined;
  }
}
