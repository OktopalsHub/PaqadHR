import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationModule } from 'src/common/integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { MemberPointsController } from './controllers/member-points.controller';
import { ShoutoutCategoriesController } from './controllers/shoutout-categories.controller';
import { ShoutoutsController } from './controllers/shoutouts.controller';
import { SlackWebhookController } from './controllers/slack-webhook.controller';
import { Shoutout } from './entities/shoutout.entity';
import { ShoutoutCategory } from './entities/shoutout-category.entity';
import { ShoutoutCategoryAssignment } from './entities/shoutout-category-assignment.entity';
import { ShoutoutRecipient } from './entities/shoutout-recipient.entity';
import { ShoutoutAuditListener } from './listeners/shoutout-audit.listener';
import { ShoutoutMemberListener } from './listeners/shoutout-member.listener';
import { ShoutoutCategoriesRepository } from './repositories/shoutout-categories.repository';
import { ShoutoutsRepository } from './repositories/shoutouts.repository';
import { CelebrationShoutoutCronService } from './services/celebration-shoutout-cron.service';
import { CelebrationShoutoutService } from './services/celebration-shoutout.service';
import { ShoutoutAuditService } from './services/shoutout-audit.service';
import { ShoutoutCategoriesService } from './services/shoutout-categories.service';
import { ShoutoutsService } from './services/shoutouts.service';
import { SlackWebhookService } from './services/slack-webhook.service';
import { ShoutoutPointsModule } from './shoutout-points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shoutout,
      ShoutoutRecipient,
      ShoutoutCategory,
      ShoutoutCategoryAssignment,
      Tenant,
    ]),
    TenantSettingsModule,
    TenantMembersModule,
    NotificationsModule,
    ShoutoutPointsModule,
    IntegrationModule,
  ],
  controllers: [
    ShoutoutsController,
    ShoutoutCategoriesController,
    MemberPointsController,
    SlackWebhookController,
  ],
  providers: [
    ShoutoutsService,
    ShoutoutCategoriesService,
    ShoutoutsRepository,
    ShoutoutCategoriesRepository,
    ShoutoutAuditService,
    ShoutoutAuditListener,
    ShoutoutMemberListener,
    SlackWebhookService,
    CelebrationShoutoutService,
    CelebrationShoutoutCronService,
  ],
  exports: [ShoutoutsService, ShoutoutPointsModule],
})
export class ShoutoutsModule {}
