import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationsModule } from '../../modules/v1/invitations/invitations.module';
import { TenantMembersModule } from '../../modules/v1/tenant-members/tenant-members.module';
import { TenantsModule } from '../../modules/v1/tenants/tenants.module';
import { IntegrationController } from './controllers/integration.controller';
import { IntegrationManagementController } from './controllers/integration-management.controller';
import { OAuthIntegrationController } from './controllers/integration-oauth.controller';
import { IntegrationChannel } from './entities/integration-channel.entity';
import { PlatformIntegration } from './entities/platform-integration.entity';
import { PlatformUser } from './entities/platform-user.entity';
import { UserIntegrationToken } from './entities/user-integration-token.entity';
import { ShoutoutIntegrationListener } from './listeners/shoutout-integration.listener';
import { IntegrationChannelRepository } from './repositories/integration-channel.repository';
import { PlatformIntegrationRepository } from './repositories/platform-integration.repository';
import { PlatformUserRepository } from './repositories/platform-user.repository';
import { UserIntegrationTokenRepository } from './repositories/user-integration-token.repository';
import { ChannelManagementService } from './services/channel-management.service';
import { IntegrationSetupService } from './services/integration-setup.service';
import { OAuthIntegrationService } from './services/oauth-integration.service';
import { PlatformIntegrationService } from './services/platform-integration.service';
import { UserSyncService } from './services/user-sync.service';

@Module({
  imports: [
    TenantsModule,
    TenantMembersModule,
    InvitationsModule,
    TypeOrmModule.forFeature([
      PlatformIntegration,
      PlatformUser,
      IntegrationChannel,
      UserIntegrationToken,
    ]),
  ],
  controllers: [IntegrationController, OAuthIntegrationController, IntegrationManagementController],
  providers: [
    ChannelManagementService,
    PlatformIntegrationService,
    PlatformIntegrationRepository,
    PlatformUserRepository,
    IntegrationChannelRepository,
    OAuthIntegrationService,
    UserIntegrationTokenRepository,
    UserSyncService,
    IntegrationSetupService,
    ShoutoutIntegrationListener,
  ],
  exports: [
    PlatformIntegrationService,
    UserSyncService,
    IntegrationSetupService,
    PlatformIntegrationRepository,
    PlatformUserRepository,
  ],
})
export class IntegrationModule {}
