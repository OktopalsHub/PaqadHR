import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PointsSettings } from '../../../../common/interfaces/points-settings.interface';
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
  ): Promise<TenantSettings> {
    const existingSettings = await this.getTenantSettings(tenantId);
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
    };
    if (updateDto.points) {
      this.validatePointsSettings(updatedSettings.points);
    }
    existingSettings.settings = updatedSettings;
    const result = await this.tenantSettingsRepository.save(existingSettings);
    this.logger.log(`Updated settings for tenant: ${tenantId}`);
    return result;
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
