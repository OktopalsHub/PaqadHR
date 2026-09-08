import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EncryptionService } from 'src/common/services/encryption.service';
import type { BillingSettings } from '../../../../common/interfaces/billing-settings.interface';
import type { PointsSettings } from '../../../../common/interfaces/points-settings.interface';
import type { RewardsSettings } from '../../../../common/interfaces/rewards-settings.interface';
import type { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';
import {
  normalizeRewardsCatalogCountries,
  resolveGiftCardProviderFromEnv,
} from '../../../../common/utils/rewards-defaults.util';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { UpdateTenantSettingsDto } from '../dto/tenant-settings.dto';
import type { TenantSettings } from '../entities/tenant-settings.entity';
import { SettingsReaderService } from './settings-reader.service';
import { TenantSettingRepository } from './tenant-setting.repository';

@Injectable()
export class SettingsWriterService {
  constructor(
    private readonly tenantSettingsRepository: TenantSettingRepository,
    private readonly settingsReader: SettingsReaderService,
    private readonly eventEmitter: EventEmitter2,
    private readonly activitiesService: ActivitiesService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async updateTenantSettings(
    tenantId: string,
    updateDto: UpdateTenantSettingsDto,
    actorMemberId: string,
  ): Promise<TenantSettings> {
    const existingSettings = await this.settingsReader.getTenantSettings(tenantId);
    const rewardsDefaults =
      updateDto.rewards !== undefined
        ? await this.settingsReader.resolveRewardsDefaults(tenantId)
        : null;
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
            'USD',
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
      settings: this.settingsReader.hydrateTenantSettings({ ...updatedSettings }),
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

  private prepareSettingsForPersistence(settings: TenantSettingsData): TenantSettingsData {
    if (!settings.billing) {
      return settings;
    }

    return {
      ...settings,
      billing: this.prepareBillingSettingsForPersistence(settings.billing),
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
}
