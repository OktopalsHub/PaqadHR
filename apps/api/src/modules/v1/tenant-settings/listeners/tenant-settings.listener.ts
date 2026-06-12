import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PartialTenantSettingsData } from '../../../../common/interfaces/partial-tenant-settings-data.interface';
import { TenantSettingsInitializationService } from '../services/tenant-settings-initialization.service';
@Injectable()
export class TenantSettingsListener {
  private readonly logger = new Logger(TenantSettingsListener.name);
  constructor(
    private readonly tenantSettingsInitializationService: TenantSettingsInitializationService,
  ) {}
  @OnEvent('tenant.settings.initialize')
  async handleTenantSettingsInitialization(payload: {
    tenantId: string;
    companyName: string;
    employeeCode?: string;
    defaultSettings: PartialTenantSettingsData;
  }) {
    try {
      this.logger.log(
        `Initializing tenant settings for tenant: ${payload.tenantId}`,
      );
      let settings: PartialTenantSettingsData = { ...payload.defaultSettings };
      if (payload.employeeCode) {
        settings = {
          ...settings,
          employee: {
            ...settings.employee,
            numberPrefix: payload.employeeCode,
          },
        };
      }
      await this.tenantSettingsInitializationService.initializeTenantSettings(
        payload.tenantId,
        settings,
      );
      this.logger.log(
        `Successfully initialized tenant settings for tenant: ${payload.tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize tenant settings for tenant ${payload.tenantId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
