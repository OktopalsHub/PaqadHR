import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettings } from './entities/tenant-settings.entity';
import { TenantConfigService } from './services/tenant-config.service';
import { TenantSettingRepository } from './services/tenant-setting.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TenantSettings])],
  providers: [TenantSettingRepository, TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
