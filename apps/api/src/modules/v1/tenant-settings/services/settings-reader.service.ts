import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EncryptionService } from 'src/common/services/encryption.service';
import { DataSource, Repository } from 'typeorm';
import type { BillingSettings } from '../../../../common/interfaces/billing-settings.interface';
import type { RewardsSettings } from '../../../../common/interfaces/rewards-settings.interface';
import type { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';
import { GeoLocationHelper } from '../../../../common/utils/geo-location.util';
import {
  normalizeRewardsCatalogCountries,
  resolveGiftCardProviderFromEnv,
  resolveInitialWalletCurrency,
} from '../../../../common/utils/rewards-defaults.util';
import { TenantWallet } from '../../rewards/entities/tenant-wallet.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type { TenantSettings } from '../entities/tenant-settings.entity';
import { TenantSettingRepository } from './tenant-setting.repository';

@Injectable()
export class SettingsReaderService {
  private readonly logger = new Logger(SettingsReaderService.name);

  constructor(
    private readonly tenantSettingsRepository: TenantSettingRepository,
    readonly _dataSource: DataSource,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    const settings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });
    if (!settings) {
      throw new BadRequestException(
        `Tenant settings not found for tenant: ${tenantId}. Please initialize tenant settings first using TenantSettingsInitializationService.`,
      );
    }
    const hydratedSettings = this.hydrateTenantSettings({ ...settings.settings });
    return Object.assign(settings, { settings: hydratedSettings });
  }

  async getTenantSettingsForDisplay(tenantId: string): Promise<TenantSettings> {
    const settings = await this.getTenantSettings(tenantId);
    const rewardsDefaults = await this.resolveRewardsDefaults(tenantId);

    settings.settings = {
      ...settings.settings,
      rewards: this.buildRewardsResponseSettings(settings.settings.rewards, rewardsDefaults),
    };
    return settings;
  }

  async resolveRewardsDefaults(tenantId: string): Promise<{
    rewardsCurrency: string;
    tenantCountryCode: string;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      select: { id: true, countryCode: true, preferredCurrency: true },
    });
    const tenantCountryCode = GeoLocationHelper.toStoredCountryCode(tenant?.countryCode) ?? 'US';

    return {
      rewardsCurrency: await this.resolveWalletRewardsCurrency(tenantId, tenant),
      tenantCountryCode,
    };
  }

  private async resolveWalletRewardsCurrency(
    tenantId: string,
    tenant?: Tenant | null,
  ): Promise<string> {
    const wallet = await this._dataSource
      .getRepository(TenantWallet)
      .findOne({ where: { tenantId } });
    if (wallet) {
      return wallet.currencyCode.toUpperCase();
    }
    return resolveInitialWalletCurrency(tenant?.countryCode, tenant?.preferredCurrency);
  }

  private buildRewardsResponseSettings(
    rewards: RewardsSettings | undefined,
    defaults: {
      rewardsCurrency: string;
      tenantCountryCode: string;
    },
  ): RewardsSettings {
    return {
      enabled: rewards?.enabled ?? true,
      pointsExchangeRate: rewards?.pointsExchangeRate ?? 1,
      rewardsCurrency: defaults.rewardsCurrency,
      catalogCountries: normalizeRewardsCatalogCountries(
        rewards?.catalogCountries,
        defaults.tenantCountryCode,
      ),
      airtimeEnabled: rewards?.airtimeEnabled ?? true,
      customRewardsEnabled: rewards?.customRewardsEnabled ?? true,
      giftCardsEnabled: rewards?.giftCardsEnabled ?? true,
      giftCardCategories: rewards?.giftCardCategories ?? [
        'Gift Cards',
        'Gaming Cards',
        'Money Cards',
      ],
      giftCardProvider: resolveGiftCardProviderFromEnv(),
      utilityPaymentsEnabled: rewards?.utilityPaymentsEnabled ?? true,
      tremendousProducts: rewards?.tremendousProducts ?? [],
    };
  }

  hydrateTenantSettings(settings: TenantSettingsData): TenantSettingsData {
    if (!settings.billing) {
      return settings;
    }

    return {
      ...settings,
      billing: this.hydrateBillingSettings(settings.billing),
    };
  }

  private hydrateBillingSettings(billing: BillingSettings): BillingSettings {
    const identityBvn =
      this.decryptIfNeeded(billing.identityBvn) ?? this.decryptIfNeeded(billing.monnifyBvn);
    const identityNin =
      this.decryptIfNeeded(billing.identityNin) ?? this.decryptIfNeeded(billing.monnifyNin);
    return {
      ...billing,
      identityBvn,
      identityNin,
      monnifyBvn: undefined,
      monnifyNin: undefined,
    };
  }

  private decryptIfNeeded(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!this.encryptionService.isEncrypted(trimmed)) {
      return trimmed;
    }
    try {
      return this.encryptionService.decrypt(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to decrypt tenant settings field: ${message}`);
      return undefined;
    }
  }
}
