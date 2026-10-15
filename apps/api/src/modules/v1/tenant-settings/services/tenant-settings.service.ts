import { Injectable } from '@nestjs/common';
import type { UpdateTenantSettingsDto } from '../dto/tenant-settings.dto';
import type { TenantSettings } from '../entities/tenant-settings.entity';
import { SettingsReaderService } from './settings-reader.service';
import { SettingsWriterService } from './settings-writer.service';

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly settingsReader: SettingsReaderService,
    private readonly settingsWriter: SettingsWriterService,
  ) {}

  async getTenantSettings(tenantId: string): Promise<TenantSettings> {
    return this.settingsReader.getTenantSettings(tenantId);
  }

  async getTenantSettingsForDisplay(tenantId: string): Promise<TenantSettings> {
    return this.settingsReader.getTenantSettingsForDisplay(tenantId);
  }

  async updateTenantSettings(
    tenantId: string,
    updateDto: UpdateTenantSettingsDto,
    actorMemberId: string,
  ): Promise<TenantSettings> {
    return this.settingsWriter.updateTenantSettings(tenantId, updateDto, actorMemberId);
  }
}
