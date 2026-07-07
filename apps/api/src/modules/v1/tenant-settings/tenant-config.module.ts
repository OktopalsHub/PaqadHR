import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettings } from './entities/tenant-settings.entity';
import { GoogleCalendarHolidayProvider } from './services/google-calendar-holiday.provider';
import { HolidayService } from './services/holiday.service';
import { TenantConfigService } from './services/tenant-config.service';
import { TenantSettingRepository } from './services/tenant-setting.repository';
import { TenantSettingsService } from './services/tenant-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantSettings])],
  providers: [
    TenantSettingRepository,
    TenantConfigService,
    TenantSettingsService,
    GoogleCalendarHolidayProvider,
    HolidayService,
  ],
  exports: [TenantConfigService, TenantSettingsService, TenantSettingRepository, HolidayService],
})
export class TenantConfigModule {}
