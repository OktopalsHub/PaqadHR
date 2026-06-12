import { UpdateTenantSettingsDto, AssignPointsDto } from '../dto/tenant-settings.dto';
import { TenantSettings } from '../entities/tenant-settings.entity';
import { TenantSettingsInitializationService } from './tenant-settings-initialization.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantSettingRepository } from './tenant-setting.repository';
import { PointsSettings } from '../../../../common/interfaces/points-settings.interface';
import { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';

@Injectable()
export class TenantSettingsService {
  private readonly logger = new Logger(TenantSettingsService.name);
  constructor(
    private readonly tenantSettingsRepository: TenantSettingRepository,
    private readonly dataSource: DataSource,
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
          ...existingSettings.settings.shoutouts,
          ...updateDto.shoutouts,
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
    };
    if (updateDto.points) {
      this.validatePointsSettings(updatedSettings.points);
    }
    existingSettings.settings = updatedSettings;
    const result = await this.tenantSettingsRepository.create(existingSettings);
    this.logger.log(`Updated settings for tenant: ${tenantId}`);
    return result;
  }
  private validatePointsSettings(pointsSettings: PointsSettings): void {
    if (
      pointsSettings.minPointsPerShoutout > pointsSettings.maxPointsPerShoutout
    ) {
      throw new BadRequestException(
        'Minimum points per shoutout cannot be greater than maximum points per shoutout',
      );
    }
    if (
      pointsSettings.autoAssignPoints &&
      pointsSettings.autoAssignAmount <= 0
    ) {
      throw new BadRequestException(
        'Auto-assign amount must be greater than 0 when auto-assign is enabled',
      );
    }
  }
}
