import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoutoutPointsModule } from '../shoutouts/shoutout-points.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SettingsReadController } from './controllers/settings-read.controller';
import { SettingsWriteController } from './controllers/settings-write.controller';
import { TenantSettings } from './entities/tenant-settings.entity';
import { TenantSettingsListener } from './listeners/tenant-settings.listener';
import { TenantSettingsInitializationService } from './services/tenant-settings-initialization.service';
import { TenantConfigModule } from './tenant-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSettings, TenantMember]),
    TenantsModule,
    TenantMembersModule,
    TenantConfigModule,
    ShoutoutPointsModule,
  ],
  controllers: [SettingsReadController, SettingsWriteController],
  providers: [TenantSettingsInitializationService, TenantSettingsListener],
  exports: [TenantSettingsInitializationService, TenantConfigModule],
})
export class TenantSettingsModule {}
