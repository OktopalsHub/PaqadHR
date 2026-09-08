import { Injectable, Logger } from '@nestjs/common';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { DataSource } from 'typeorm';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';

@Injectable()
export class RewardsCatalogSyncService {
  private readonly logger = new Logger(RewardsCatalogSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly fiatExchange: FiatExchangeService,
    private readonly tremendousApi: TremendousApiService,
  ) {}

  private get tenantSettingsRepo() {
    return this.dataSource.getRepository(TenantSettings);
  }

  async toWalletCurrency(
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

  async syncTremendousProducts(
    tenantId: string,
    settings: RewardsSettings,
    existing?: NonNullable<RewardsSettings['tremendousProducts']>,
    options?: { force?: boolean },
  ): Promise<NonNullable<RewardsSettings['tremendousProducts']>> {
    const row = await this.tenantSettingsRepo.findOne({ where: { tenantId } });
    if (!row) return [];
    const current = existing ?? row.settings?.rewards?.tremendousProducts ?? [];
    if (!options?.force && current.length > 0) return current;
    if (!this.tremendousApi.isConfigured()) return current;
    const products = await this.buildTremendousProductRecords(tenantId, settings);
    row.settings = { ...row.settings, rewards: { ...settings, tremendousProducts: products } };
    await this.tenantSettingsRepo.save(row);
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
    const feePercentage = 2;
    const exchangeRate = settings.pointsExchangeRate;
    const allowlistSet = new Set(allowlist);
    const records: NonNullable<RewardsSettings['tremendousProducts']> = [];

    for (const p of products) {
      try {
        const productCountries = Array.from(
          new Set(
            (p.countries ?? [])
              .map((c) => GeoLocationHelper.toStoredCountryCode(c.abbr))
              .filter((c): c is string => Boolean(c)),
          ),
        );
        const matchingCountries =
          allowlistSet.size > 0
            ? productCountries.filter((c) => allowlistSet.has(c))
            : productCountries;
        if (matchingCountries.length === 0) continue;
        const denoms = this.tremendousSkusToDenoms(p.skus);
        const listCost = denoms.fixedDenominations[0] ?? denoms.minDenomination;
        if (listCost == null) continue;
        const currencyCode = p.currency_codes?.[0] ?? settings.rewardsCurrency;
        const imageUrl =
          p.images?.find((i) => i.type === 'card')?.src ?? p.images?.[0]?.src ?? null;

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
    return records.filter((r) => {
      const key = `${r.productId}:${r.countryCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  tremendousSkusToDenoms(skus: Array<{ min: number; max: number }> | undefined): {
    fixedDenominations: number[];
    minDenomination: number | null;
    maxDenomination: number | null;
  } {
    if (!skus?.length)
      return { fixedDenominations: [], minDenomination: null, maxDenomination: null };
    const fixed = skus
      .filter((s) => s.min === s.max)
      .map((s) => s.min)
      .sort((a, b) => a - b);
    const ranges = skus.filter((s) => s.min !== s.max);
    if (fixed.length > 0 && ranges.length === 0)
      return {
        fixedDenominations: fixed,
        minDenomination: fixed[0],
        maxDenomination: fixed[fixed.length - 1],
      };
    return {
      fixedDenominations: [],
      minDenomination: Math.min(...skus.map((s) => s.min)),
      maxDenomination: Math.max(...skus.map((s) => s.max)),
    };
  }
}
