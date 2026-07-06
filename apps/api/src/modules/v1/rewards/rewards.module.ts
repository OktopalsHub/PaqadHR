import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { ReloadlyApiService } from 'src/common/services/reloadly-api.service';
import { ReloadlyTopupsApiService } from 'src/common/services/reloadly-topups-api.service';
import { ReloadlyUtilitiesApiService } from 'src/common/services/reloadly-utilities-api.service';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { RewardsController } from './controllers/rewards.controller';
import { CustomReward } from './entities/custom-reward.entity';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { Task } from './entities/task.entity';
import { TaskSubmission } from './entities/task-submission.entity';
import { TenantWallet } from './entities/tenant-wallet.entity';
import { TenantWalletTransaction } from './entities/tenant-wallet-transaction.entity';
import { RewardsListener } from './listeners/rewards.listener';
import { CustomRewardsService } from './services/custom-rewards.service';
import { ReloadlyWebhookService } from './services/reloadly-webhook.service';
import { RewardsService } from './services/rewards.service';
import { RewardsCatalogSyncCronService } from './services/rewards-catalog-sync-cron.service';
import { TenantWalletService } from './services/tenant-wallet.service';
import { TenantWalletTopupService } from './services/tenant-wallet-topup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantWallet,
      TenantWalletTransaction,
      CustomReward,
      RewardRedemption,
      Task,
      TaskSubmission,
      Tenant,
      TenantSettings,
    ]),
    PaymentsModule,
    TenantConfigModule,
    SubscriptionsModule,
    NotificationsModule,
    ShoutoutsModule,
    TenantMembersModule,
    ActivitiesModule,
  ],
  controllers: [RewardsController],
  providers: [
    RewardsService,
    TenantWalletService,
    TenantWalletTopupService,
    CustomRewardsService,
    ReloadlyWebhookService,
    ReloadlyApiService,
    ReloadlyTopupsApiService,
    FiatExchangeService,
    ReloadlyUtilitiesApiService,
    NombaBillApiService,
    RewardsListener,
    RewardsCatalogSyncCronService,
  ],
  exports: [RewardsService, TenantWalletService, TenantWalletTopupService, ReloadlyWebhookService],
})
export class RewardsModule {}
