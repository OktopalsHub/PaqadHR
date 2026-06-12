import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoutoutsModule } from '../../modules/v1/shoutouts/shoutouts.module';
import { TenantMembersModule } from '../../modules/v1/tenant-members/tenant-members.module';
import { TenantsModule } from '../../modules/v1/tenants/tenants.module';
import { ChannelManagementService } from './services/channel-management.service';
import { IntegrationSetupService } from './services/integration-setup.service';
import { OAuthIntegrationService } from './services/oauth-integration.service';
import { PlatformIntegrationService } from './services/platform-integration.service';
import { SlackWebhookService } from './services/slack-webhook.service';
import { UserSyncService } from './services/user-sync.service';
import { PlatformIntegration } from './entities/platform-integration.entity';
import { PlatformUser } from './entities/platform-user.entity';
import { IntegrationChannel } from './entities/integration-channel.entity';
import { UserIntegrationToken } from './entities/user-integration-token.entity';
import { IntegrationController } from './controllers/integration.controller';
import { OAuthIntegrationController } from './controllers/integration-oauth.controller';
import { SlackWebhookController } from './controllers/slack-webhook.controller';
import { IntegrationManagementController } from './controllers/integration-management.controller';
import { PlatformIntegrationRepository } from './repositories/platform-integration.repository';
import { PlatformUserRepository } from './repositories/platform-user.repository';
import { IntegrationChannelRepository } from './repositories/integration-channel.repository';
import { UserIntegrationTokenRepository } from './repositories/user-integration-token.repository';
import { ShoutoutIntegrationListener } from './listeners/shoutout-integration.listener';

@Module({
  imports: [
    TenantsModule,
    TenantMembersModule,
    ShoutoutsModule,
    TypeOrmModule.forFeature([
      PlatformIntegration,
      PlatformUser,
      IntegrationChannel,
      UserIntegrationToken,
    ]),
  ],
  controllers: [
    IntegrationController,
    OAuthIntegrationController,
    SlackWebhookController,
    IntegrationManagementController,
  ],
  providers: [
    ChannelManagementService,
    PlatformIntegrationService,
    PlatformIntegrationRepository,
    PlatformUserRepository,
    IntegrationChannelRepository,
    OAuthIntegrationService,
    UserIntegrationTokenRepository,
    UserSyncService,
    SlackWebhookService,
    IntegrationSetupService,
    ShoutoutIntegrationListener,
  ],
  exports: [
    PlatformIntegrationService,
    UserSyncService,
    IntegrationSetupService,
  ],
})
export class IntegrationModule {}
