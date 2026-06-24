import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PartialTenantSettingsData } from '../../../../common/interfaces/partial-tenant-settings-data.interface';
import type { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';
import type { TenantSettings } from '../entities/tenant-settings.entity';
import { TenantSettingRepository } from './tenant-setting.repository';

@Injectable()
export class TenantSettingsInitializationService {
  private readonly logger = new Logger(TenantSettingsInitializationService.name);
  constructor(private readonly tenantSettingsRepository: TenantSettingRepository) {}
  async initializeTenantSettings(
    tenantId: string,
    customSettings: PartialTenantSettingsData,
  ): Promise<TenantSettings> {
    const existingSettings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });
    if (existingSettings) {
      this.logger.warn(`Tenant settings already exist for tenant: ${tenantId}`);
      return existingSettings;
    }
    const defaultSettings: TenantSettingsData = {
      points: {
        monthlyAllowance: 100,
        allowancePeriod: 'monthly',
        maxPointsPerShoutout: 50,
        minPointsPerShoutout: 1,
        autoAssignPoints: true,
        autoAssignAmount: 100,
        startingBalance: 100,
        dailyLimit: 50,
        monthlyLimit: 1000,
      },
      notifications: {
        emailNotifications: true,
        slackNotifications: false,
      },
      shoutouts: {
        maxRecipientsPerShoutout: 10,
        enableCategories: true,
        birthday: {
          enabled: true,
          points: 25,
          messageTemplate: 'Happy birthday, {name}! 🎉 Wishing you a wonderful day from the whole team.',
        },
        workAnniversary: {
          enabled: true,
          points: 50,
          messageTemplate:
            'Congratulations on {years} year(s) with us, {name}! 🎊 Thank you for everything you do.',
        },
      },
      general: {
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        currency: 'USD',
        language: 'en',
        companyName: '',
        emailPayslipOnPublish: false,
      },
      attendance: {
        weekends: [0, 6],
        clockInEnabled: false,
      },
      employee: {
        numberPrefix: '',
        numberPadding: 3,
      },
      holidays: {
        customHolidays: [],
        excludeWeekends: true,
      },
      billing: {},
    };
    const finalSettings: TenantSettingsData = {
      points: { ...defaultSettings.points, ...customSettings.points },
      notifications: {
        ...defaultSettings.notifications,
        ...customSettings.notifications,
      },
      shoutouts: { ...defaultSettings.shoutouts, ...customSettings.shoutouts },
      general: { ...defaultSettings.general, ...customSettings.general },
      attendance: {
        ...defaultSettings.attendance,
        ...customSettings.attendance,
      },
      employee: { ...defaultSettings.employee, ...customSettings.employee },
      holidays: {
        ...defaultSettings.holidays,
        ...customSettings.holidays,
      },
      billing: {
        ...defaultSettings.billing,
        ...customSettings.billing,
      },
    };
    this.validateSettings(finalSettings);
    const newSettings = {
      tenantId,
      settings: finalSettings,
    };
    const savedSettings = await this.tenantSettingsRepository.save(newSettings);
    this.logger.log(`Initialized tenant settings for tenant: ${tenantId}`);
    return savedSettings;
  }
  async bulkInitializeTenantSettings(
    tenantIds: string[],
    customSettings: PartialTenantSettingsData,
  ): Promise<
    {
      tenantId: string;
      success: boolean;
      settings?: TenantSettings;
      error?: string;
    }[]
  > {
    const results: {
      tenantId: string;
      success: boolean;
      settings?: TenantSettings;
      error?: string;
    }[] = [];
    for (const tenantId of tenantIds) {
      try {
        const settings = await this.initializeTenantSettings(tenantId, customSettings);
        results.push({
          tenantId,
          success: true,
          settings,
        });
      } catch (error) {
        this.logger.error(`Failed to initialize settings for tenant ${tenantId}: ${error.message}`);
        results.push({
          tenantId,
          success: false,
          error: error.message,
        });
      }
    }
    return results;
  }
  async initializeTenantSettingsWithCompanyDefaults(
    tenantId: string,
    companyName: string,
    companyDefaults?: {
      timezone?: string;
      currency?: string;
      language?: string;
      monthlyPointsAllowance?: number;
      enableNotifications?: boolean;
    },
  ): Promise<TenantSettings> {
    const customSettings: PartialTenantSettingsData = {
      general: {
        companyName,
        timezone: companyDefaults?.timezone || 'UTC',
        currency: companyDefaults?.currency || 'USD',
        language: companyDefaults?.language || 'en',
        dateFormat: 'YYYY-MM-DD',
      },
      points: {
        monthlyAllowance: companyDefaults?.monthlyPointsAllowance || 100,
        maxPointsPerShoutout: 50,
        minPointsPerShoutout: 1,
        autoAssignPoints: true,
        autoAssignAmount: 100,
      },
      shoutouts: {
        maxRecipientsPerShoutout: 10,
        enableCategories: true,
        birthday: {
          enabled: true,
          points: 25,
          messageTemplate: 'Happy birthday, {name}! 🎉 Wishing you a wonderful day from the whole team.',
        },
        workAnniversary: {
          enabled: true,
          points: 50,
          messageTemplate:
            'Congratulations on {years} year(s) with us, {name}! 🎊 Thank you for everything you do.',
        },
      },
      notifications: {
        emailNotifications: companyDefaults?.enableNotifications ?? true,
        slackNotifications: false,
      },
    };
    return this.initializeTenantSettings(tenantId, customSettings);
  }
  async updateTenantSettingsPartial(
    tenantId: string,
    updates: PartialTenantSettingsData,
  ): Promise<TenantSettings> {
    const existingSettings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });
    if (!existingSettings) {
      throw new NotFoundException(`Tenant settings not found for tenant: ${tenantId}`);
    }
    const updatedSettings: TenantSettingsData = {
      points: { ...existingSettings.settings.points, ...updates.points },
      notifications: {
        ...existingSettings.settings.notifications,
        ...updates.notifications,
      },
      shoutouts: {
        ...existingSettings.settings.shoutouts,
        ...updates.shoutouts,
      },
      general: { ...existingSettings.settings.general, ...updates.general },
      attendance: {
        ...existingSettings.settings.attendance,
        ...updates.attendance,
      },
      employee: { ...existingSettings.settings.employee, ...updates.employee },
      holidays: {
        ...existingSettings.settings.holidays,
        ...updates.holidays,
      },
      billing: {
        ...(existingSettings.settings.billing ?? {}),
        ...updates.billing,
      },
    };
    this.validateSettings(updatedSettings);
    existingSettings.settings = updatedSettings;
    const savedSettings = await this.tenantSettingsRepository.save(existingSettings);
    this.logger.log(`Updated tenant settings for tenant: ${tenantId}`);
    return savedSettings;
  }
  async resetTenantSettingsToDefaults(tenantId: string): Promise<TenantSettings> {
    const existingSettings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });
    if (!existingSettings) {
      throw new NotFoundException(`Tenant settings not found for tenant: ${tenantId}`);
    }
    const companyName = existingSettings.settings.general?.companyName || '';
    await this.tenantSettingsRepository.delete(existingSettings.id);
    return this.initializeTenantSettings(tenantId, {
      general: { companyName },
    });
  }
  private validateSettings(settings: TenantSettingsData): void {
    if (settings.points.minPointsPerShoutout > settings.points.maxPointsPerShoutout) {
      throw new BadRequestException(
        'Minimum Paq points per shoutout cannot be greater than maximum Paq points per shoutout',
      );
    }
    if (settings.points.monthlyAllowance < 0) {
      throw new BadRequestException('Monthly allowance cannot be negative');
    }
    if (settings.points.autoAssignPoints && settings.points.autoAssignAmount <= 0) {
      throw new BadRequestException(
        'Auto-assign amount must be greater than 0 when auto-assign is enabled',
      );
    }
    if (settings.shoutouts.maxRecipientsPerShoutout < 1) {
      throw new BadRequestException('Maximum recipients per shoutout must be at least 1');
    }
    if (!settings.general.timezone) {
      throw new BadRequestException('Timezone is required');
    }
    if (!settings.general.currency) {
      throw new BadRequestException('Currency is required');
    }
    if (!settings.general.language) {
      throw new BadRequestException('Language is required');
    }
  }
  async initializeTenantWorkspace(
    tenantId: string,
    customSettings: PartialTenantSettingsData,
  ): Promise<{
    tenantSettings: TenantSettings;
  }> {
    const tenantSettings = await this.initializeTenantSettings(tenantId, customSettings);

    return {
      tenantSettings,
    };
  }
}
