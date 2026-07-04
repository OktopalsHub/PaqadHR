import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import type { PointsSettings } from '../../../../common/interfaces/points-settings.interface';
import type { RewardsSettings } from '../../../../common/interfaces/rewards-settings.interface';
import type { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';
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
    return settings;
  }
  async updateTenantSettings(
    tenantId: string,
    updateDto: UpdateTenantSettingsDto,
    actorMemberId?: string,
  ): Promise<TenantSettings> {
    const existingSettings = await this.getTenantSettings(tenantId);
    const prevCatalogCountries = existingSettings.settings.rewards?.catalogCountries ?? [];
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
          enabled: updateDto.rewards.enabled ?? existingSettings.settings.rewards?.enabled ?? false,
          pointsExchangeRate:
            updateDto.rewards.pointsExchangeRate ??
            existingSettings.settings.rewards?.pointsExchangeRate ??
            1,
          rewardsCurrency:
            updateDto.rewards.rewardsCurrency ??
            existingSettings.settings.rewards?.rewardsCurrency ??
            'NGN',
          catalogCountries: updateDto.rewards.catalogCountries ??
            existingSettings.settings.rewards?.catalogCountries ?? ['NG'],
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
          utilityPaymentsEnabled:
            updateDto.rewards.utilityPaymentsEnabled ??
            existingSettings.settings.rewards?.utilityPaymentsEnabled ??
            true,
          reloadlyProducts:
            updateDto.rewards.reloadlyProducts ??
            existingSettings.settings.rewards?.reloadlyProducts ??
            [],
        },
      }),
    };
    if (updateDto.points) {
      this.validatePointsSettings(updatedSettings.points);
    }
    if (updateDto.rewards) {
      this.validateRewardsSettings(updatedSettings.rewards);
    }
    existingSettings.settings = updatedSettings;
    const result = await this.tenantSettingsRepository.save(existingSettings);
    this.logger.log(`Updated settings for tenant: ${tenantId}`);

    const newCatalogCountries = updatedSettings.rewards?.catalogCountries ?? [];
    const catalogCountriesChanged =
      updateDto.rewards?.catalogCountries !== undefined &&
      !sameCountrySet(prevCatalogCountries, newCatalogCountries);
    if (catalogCountriesChanged) {
      this.eventEmitter.emit('rewards.catalogCountriesChanged', { tenantId });
    }

    return result;
  }
  private validateRewardsSettings(rewardsSettings: RewardsSettings | undefined): void {
    if (!rewardsSettings) {
      return;
    }
    const rate = rewardsSettings.pointsExchangeRate;
    if (rate !== undefined && rate < 1) {
      throw new BadRequestException('Points exchange rate must be at least 1');
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
}

function sameCountrySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((code, i) => code === sortedB[i]);
}
