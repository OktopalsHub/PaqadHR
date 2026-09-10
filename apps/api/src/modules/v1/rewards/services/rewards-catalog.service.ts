import { Injectable } from '@nestjs/common';
import type { RewardsSettings } from 'src/common/interfaces/rewards-settings.interface';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { DataSource } from 'typeorm';
import { RewardsCatalogQueryService } from './rewards-catalog-query.service';
import { RewardsCatalogSyncService } from './rewards-catalog-sync.service';

export type CatalogItem = {
  id: string;
  name: string;
  type: string;
  pointsCost: number;
  currencyValue: number;
  currencyCode?: string;
  countryCode?: string;
  imageUrl?: string | null;
  minDenomination?: number | null;
  maxDenomination?: number | null;
  fixedDenominations?: number[];
  adminPricing?: {
    reloadlyCost: number;
    reloadlyCostCurrency: string;
  };
};

@Injectable()
export class RewardsCatalogService {
  constructor(
    readonly _dataSource: DataSource,
    readonly _fiatExchange: FiatExchangeService,
    readonly _tremendousApi: TremendousApiService,
    private readonly queryService: RewardsCatalogQueryService,
    private readonly syncService: RewardsCatalogSyncService,
  ) {}

  async toWalletCurrency(
    localAmount: number,
    localCurrency: string,
    walletCurrency: string,
    operatorId?: number,
    countryCode?: string,
  ): Promise<number> {
    return this.syncService.toWalletCurrency(
      localAmount,
      localCurrency,
      walletCurrency,
      operatorId,
      countryCode,
    );
  }

  async getRewardsContext(
    tenantId: string,
  ): Promise<{ settings: RewardsSettings; countryCode: string | null }> {
    return this.queryService.getRewardsContext(tenantId);
  }

  async getRewardsSettings(tenantId: string): Promise<RewardsSettings> {
    return this.queryService.getRewardsSettings(tenantId);
  }

  resolveCatalogCountrySelection(
    settings: RewardsSettings,
    tenantCountryCode: string | null,
    requestedCountry?: string | null,
  ): string {
    return this.queryService.resolveCatalogCountrySelection(
      settings,
      tenantCountryCode,
      requestedCountry,
    );
  }

  resolveTremendousProduct(
    settings: RewardsSettings,
    rewardId: string,
  ): NonNullable<RewardsSettings['tremendousProducts']>[number] | undefined {
    return this.queryService.resolveTremendousProduct(settings, rewardId);
  }

  extractTremendousProductId(rewardId: string): string | undefined {
    return this.queryService.extractTremendousProductId(rewardId);
  }

  async getCatalogCountries(tenantId: string): Promise<Array<{ code: string; name: string }>> {
    return this.queryService.getCatalogCountries(tenantId);
  }

  async getCatalog(
    tenantId: string,
    options?: { includeAdminPricing?: boolean; countryCode?: string | null },
  ): Promise<CatalogItem[]> {
    let { settings, countryCode } = await this.queryService.getRewardsContext(tenantId);
    if (!settings.enabled) return [];
    const catalogCountry = this.queryService.resolveCatalogCountrySelection(
      settings,
      countryCode,
      options?.countryCode,
    );
    let synced = false;
    if ((settings.tremendousProducts ?? []).length === 0) {
      await this.syncService.syncTremendousProducts(tenantId, settings);
      synced = true;
    }
    if (synced) settings = (await this.queryService.getRewardsContext(tenantId)).settings;
    return this.queryService.getCatalog(tenantId, settings, catalogCountry, options);
  }

  async syncCatalog(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<{ providers: Array<'tremendous'>; count: number }> {
    const settings = await this.queryService.getRewardsSettings(tenantId);
    const products = await this.syncService.syncTremendousProducts(
      tenantId,
      settings,
      undefined,
      options,
    );
    return { providers: ['tremendous'], count: products.length };
  }

  async syncTremendousProducts(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<NonNullable<RewardsSettings['tremendousProducts']>> {
    const settings = await this.queryService.getRewardsSettings(tenantId);
    return this.syncService.syncTremendousProducts(tenantId, settings, undefined, options);
  }
}
