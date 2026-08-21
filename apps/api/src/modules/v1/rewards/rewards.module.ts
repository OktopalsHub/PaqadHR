import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { Employment } from '../employment/entities/employment.entity';
import { ShoutoutMemberPoints } from '../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../shoutouts/entities/shoutout-point-transaction.entity';
import { Shoutout } from '../shoutouts/entities/shoutout.entity';
import { RewardsController } from './controllers/rewards.controller';
import { CustomReward } from './entities/custom-reward.entity';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { Task } from './entities/task.entity';
import { TaskSubmission } from './entities/task-submission.entity';
import { TenantWallet } from './entities/tenant-wallet.entity';
import { TenantWalletTransaction } from './entities/tenant-wallet-transaction.entity';
import { RewardsListener } from './listeners/rewards.listener';
import { CustomRewardsService } from './services/custom-rewards.service';
import { RewardsService } from './services/rewards.service';
import { RewardsCatalogService } from './services/rewards-catalog.service';
import { RewardsRedemptionService } from './services/rewards-redemption.service';
import { RewardsTasksService } from './services/rewards-tasks.service';
import { RewardsFeeService } from './services/rewards-fee.service';
import { RewardsProviderService } from './services/rewards-provider.service';
import { RewardsPointsService } from './services/rewards-points.service';
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
      Employment,
      ShoutoutMemberPoints,
      ShoutoutPointTransaction,
      Shoutout,
    ]),
    PaymentsModule,
    TenantConfigModule,
    SubscriptionsModule,
    NotificationsModule,
    ShoutoutsModule,
    TenantMembersModule,
    ActivitiesModule,
    TenantsModule,
  ],
  controllers: [RewardsController],
  providers: [
    RewardsService,
    RewardsCatalogService,
    RewardsRedemptionService,
    RewardsTasksService,
    RewardsFeeService,
    RewardsProviderService,
    RewardsPointsService,
    TenantWalletService,
    TenantWalletTopupService,
    CustomRewardsService,
    FiatExchangeService,
    NombaBillApiService,
    MonnifyBillApiService,
    TremendousApiService,
    RewardsListener,
    RewardsCatalogSyncCronService,
  ],
  exports: [
    RewardsService,
    RewardsCatalogService,
    RewardsRedemptionService,
    RewardsTasksService,
    TenantWalletService,
    TenantWalletTopupService,
  ],
})
export class RewardsModule {}
