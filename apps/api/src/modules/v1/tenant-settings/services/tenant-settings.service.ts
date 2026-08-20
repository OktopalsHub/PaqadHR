import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { EncryptionService } from 'src/common/services/encryption.service';
import { DataSource, Repository } from 'typeorm';
import type { BillingSettings } from '../../../../common/interfaces/billing-settings.interface';
import type { PointsSettings } from '../../../../common/interfaces/points-settings.interface';
import type { RewardsSettings } from '../../../../common/interfaces/rewards-settings.interface';
import type { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';
import { GeoLocationHelper } from '../../../../common/utils/geo-location.util';
import {
  DEFAULT_WALLET_CURRENCY_FALLBACK,
  normalizeRewardsCatalogCountries,
  resolveGiftCardProviderFromEnv,
  resolveInitialWalletCurrency,
} from '../../../../common/utils/rewards-defaults.util';
import { ActivitiesService } from '../../activities/services/activities.service';
import { TenantWallet } from '../../rewards/entities/tenant-wallet.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type { UpdateTenantSettingsDto } from '../dto/tenant-settings.dto';
import type { TenantSettings } from '../entities/tenant-settings.entity';
import { TenantSettingRepository } from './tenant-setting.repository';

@Injectable()
export class TenantSettingsService {
  private readonly logger = new Logger(TenantSettingsService.name);

  constructor(
    private readonly tenantSettingsRepository: TenantSettingRepository,
    readonly _dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly activitiesService: ActivitiesService,
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
  async updateTenantSettings(
    tenantId: string,
    updateDto: UpdateTenantSettingsDto,
    actorMemberId: string,
  ): Promise<TenantSettings> {
    const existingSettings = await this.getTenantSettings(tenantId);
    const rewardsDefaults =
      updateDto.rewards !== undefined ? await this.resolveRewardsDefaults(tenantId) : null;
    const prevCatalogCountries = normalizeRewardsCatalogCountries(
      existingSettings.settings.rewards?.catalogCountries,
      rewardsDefaults?.tenantCountryCode ?? 'US',
    );
    const updatedSettings: TenantSettingsData = {
      ...existingSettings.settings,
      ...(updateDto.points && {
        points: { ...existingSettings.settings.points, ...updateDto.points },
      }),
      ...(updateDto.notifications && {
        notifications: {
          ...existingSettings.settings.notifications,
          ...updateDto.notifications,
        },
      }),
      ...(updateDto.shoutouts && {
        shoutouts: {
          maxRecipientsPerShoutout:
            updateDto.shoutouts.maxRecipientsPerShoutout ??
            existingSettings.settings.shoutouts?.maxRecipientsPerShoutout ??
            10,
          enableCategories:
            updateDto.shoutouts.enableCategories ??
            existingSettings.settings.shoutouts?.enableCategories ??
            true,
          birthday: updateDto.shoutouts.birthday
            ? {
                enabled:
                  updateDto.shoutouts.birthday.enabled ??
                  existingSettings.settings.shoutouts?.birthday?.enabled ??
                  true,
                points:
                  updateDto.shoutouts.birthday.points ??
                  existingSettings.settings.shoutouts?.birthday?.points ??
                  25,
                messageTemplate:
                  updateDto.shoutouts.birthday.messageTemplate ??
                  existingSettings.settings.shoutouts?.birthday?.messageTemplate ??
                  '',
              }
            : existingSettings.settings.shoutouts?.birthday,
          workAnniversary: updateDto.shoutouts.workAnniversary
            ? {
                enabled:
                  updateDto.shoutouts.workAnniversary.enabled ??
                  existingSettings.settings.shoutouts?.workAnniversary?.enabled ??
                  true,
                points:
                  updateDto.shoutouts.workAnniversary.points ??
                  existingSettings.settings.shoutouts?.workAnniversary?.points ??
                  50,
                messageTemplate:
                  updateDto.shoutouts.workAnniversary.messageTemplate ??
                  existingSettings.settings.shoutouts?.workAnniversary?.messageTemplate ??
                  '',
              }
            : existingSettings.settings.shoutouts?.workAnniversary,
        },
      }),
      ...(updateDto.general && {
        general: { ...existingSettings.settings.general, ...updateDto.general },
      }),
      ...(updateDto.attendance && {
        attendance: {
          ...existingSettings.settings.attendance,
          ...updateDto.attendance,
        },
      }),
      ...(updateDto.employee && {
        employee: {
          ...existingSettings.settings.employee,
          ...updateDto.employee,
        },
      }),
      ...(updateDto.holidays && {
        holidays: {
          ...existingSettings.settings.holidays,
          ...updateDto.holidays,
        },
      }),
      ...(updateDto.billing && {
        billing: {
          ...(existingSettings.settings.billing ?? {}),
          ...updateDto.billing,
        },
      }),
      ...(updateDto.rewards && {
        rewards: {
          ...existingSettings.settings.rewards,
          ...updateDto.rewards,
          enabled: updateDto.rewards.enabled ?? existingSettings.settings.rewards?.enabled ?? true,
          pointsExchangeRate:
            updateDto.rewards.pointsExchangeRate ??
            existingSettings.settings.rewards?.pointsExchangeRate ??
            1,
          rewardsCurrency:
            rewardsDefaults?.rewardsCurrency ??
            existingSettings.settings.rewards?.rewardsCurrency ??
            DEFAULT_WALLET_CURRENCY_FALLBACK,
          catalogCountries: normalizeRewardsCatalogCountries(
            updateDto.rewards.catalogCountries ??
              existingSettings.settings.rewards?.catalogCountries,
            rewardsDefaults?.tenantCountryCode ?? 'US',
          ),
          airtimeEnabled:
            updateDto.rewards.airtimeEnabled ??
            existingSettings.settings.rewards?.airtimeEnabled ??
            true,
          customRewardsEnabled:
            updateDto.rewards.customRewardsEnabled ??
            existingSettings.settings.rewards?.customRewardsEnabled ??
            true,
          giftCardsEnabled:
            updateDto.rewards.giftCardsEnabled ??
            existingSettings.settings.rewards?.giftCardsEnabled ??
            true,
          giftCardCategories: updateDto.rewards.giftCardCategories ??
            existingSettings.settings.rewards?.giftCardCategories ?? [
              'Gift Cards',
              'Gaming Cards',
              'Money Cards',
            ],
          // Platform env selects the provider; ignore any client-supplied value.
          giftCardProvider: resolveGiftCardProviderFromEnv(),
          utilityPaymentsEnabled:
            updateDto.rewards.utilityPaymentsEnabled ??
            existingSettings.settings.rewards?.utilityPaymentsEnabled ??
            true,
          tremendousProducts:
            updateDto.rewards.tremendousProducts ??
            existingSettings.settings.rewards?.tremendousProducts ??
            [],
        },
      }),
    };
    if ('ngBillsProvider' in (updatedSettings.rewards ?? {})) {
      delete (updatedSettings.rewards as { ngBillsProvider?: unknown }).ngBillsProvider;
    }
    if (updateDto.points) {
      this.validatePointsSettings(updatedSettings.points);
    }
    if (updateDto.rewards) {
      this.validateRewardsSettings(updatedSettings.rewards);
    }
    existingSettings.settings = this.prepareSettingsForPersistence(updatedSettings);
    const result = await this.tenantSettingsRepository.save(existingSettings);

    const nextCatalogCountries = normalizeRewardsCatalogCountries(
      updatedSettings.rewards?.catalogCountries,
      rewardsDefaults?.tenantCountryCode ?? 'US',
    );
    const catalogCountriesChanged =
      updateDto.rewards !== undefined &&
      (prevCatalogCountries.length !== nextCatalogCountries.length ||
        prevCatalogCountries.some((code, index) => code !== nextCatalogCountries[index]));
    if (catalogCountriesChanged) {
      this.eventEmitter.emit('rewards.catalogCountriesChanged', { tenantId });
    }

    const sections = (Object.keys(updateDto) as (keyof UpdateTenantSettingsDto)[]).filter(
      (key) => updateDto[key] !== undefined,
    );
    if (sections.length > 0) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'settings.updated',
          resourceType: 'settings',
          description: `Updated ${sections.join(', ')} settings`,
          metadata: { sections },
        })
        .catch(() => {});
    }

    return Object.assign(result, {
      settings: this.hydrateTenantSettings({ ...updatedSettings }),
    });
  }
  private validateRewardsSettings(rewardsSettings: RewardsSettings | undefined): void {
    if (!rewardsSettings) {
      return;
    }
    const rate = rewardsSettings.pointsExchangeRate;
    if (rate !== undefined && rate <= 0) {
      throw new BadRequestException('Points exchange rate must be greater than 0');
    }
  }

  private async resolveRewardsDefaults(tenantId: string): Promise<{
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

  private validatePointsSettings(pointsSettings: PointsSettings): void {
    if (pointsSettings.minPointsPerShoutout > pointsSettings.maxPointsPerShoutout) {
      throw new BadRequestException(
        'Minimum Paq points per shoutout cannot be greater than maximum Paq points per shoutout',
      );
    }
    if (pointsSettings.autoAssignPoints && pointsSettings.autoAssignAmount <= 0) {
      throw new BadRequestException(
        'Auto-assign amount must be greater than 0 when auto-assign is enabled',
      );
    }
  }

  private hydrateTenantSettings(settings: TenantSettingsData): TenantSettingsData {
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

  private prepareBillingSettingsForPersistence(billing: BillingSettings): BillingSettings {
    const identityBvn = billing.identityBvn ?? billing.monnifyBvn;
    const identityNin = billing.identityNin ?? billing.monnifyNin;
    return {
      ...billing,
      identityBvn: this.encryptIfNeeded(identityBvn),
      identityNin: this.encryptIfNeeded(identityNin),
      monnifyBvn: undefined,
      monnifyNin: undefined,
      hasIdentityBvn: undefined,
      hasIdentityNin: undefined,
    };
  }

  private prepareSettingsForPersistence(settings: TenantSettingsData): TenantSettingsData {
    if (!settings.billing) {
      return settings;
    }

    return {
      ...settings,
      billing: this.prepareBillingSettingsForPersistence(settings.billing),
    };
  }

  private encryptIfNeeded(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }
    if (this.encryptionService.isEncrypted(trimmed)) {
      return trimmed;
    }
    return this.encryptionService.encrypt(trimmed);
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
