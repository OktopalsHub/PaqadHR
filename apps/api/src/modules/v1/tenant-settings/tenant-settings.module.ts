import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ShoutoutPointsModule } from '../shoutouts/shoutout-points.module';
import { TenantConfigModule } from './tenant-config.module';
import { TenantSettingsInitializationService } from './services/tenant-settings-initialization.service';
import { TenantSettingsService } from './services/tenant-settings.service';
import { TenantSettings } from './entities/tenant-settings.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantSettingsController } from './controllers/tenant-settings.controller';
import { TenantSettingRepository } from './services/tenant-setting.repository';
import { TenantSettingsListener } from './listeners/tenant-settings.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSettings, TenantMember]),
    TenantsModule,
    TenantMembersModule,
    TenantConfigModule,
    ShoutoutPointsModule,
  ],
  controllers: [TenantSettingsController],
  providers: [
    TenantSettingsService,
    TenantSettingsInitializationService,
    TenantSettingRepository,
    TenantSettingsListener,
  ],
  exports: [
    TenantSettingsService,
    TenantSettingsInitializationService,
    TenantConfigModule,
  ],
})
export class TenantSettingsModule {}
