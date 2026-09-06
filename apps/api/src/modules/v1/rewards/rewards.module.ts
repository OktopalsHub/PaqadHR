import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NombaCheckoutAdapter } from 'src/common/providers/checkout-providers/nomba-checkout.adapter';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { FiatExchangeService } from 'src/common/services/fiat-exchange.service';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { ActivitiesModule } from '../activities/activities.module';
import { Employment } from '../employment/entities/employment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { NombaApiService } from '../subscriptions/services/nomba-api.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsModule } from '../tenants/tenants.module';
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
import { RewardsCatalogSyncCronService } from './services/rewards-catalog-sync-cron.service';
import { RewardsClaimService } from './services/rewards-claim.service';
import { RewardsClaimCronService } from './services/rewards-claim-cron.service';
import { RewardsTaskService } from './services/rewards-task.service';
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
    RewardsClaimService,
    RewardsTaskService,
    TenantWalletService,
    TenantWalletTopupService,
    CustomRewardsService,
    FiatExchangeService,
    NombaBillApiService,
    MonnifyBillApiService,
    TremendousApiService,
    RewardsListener,
    RewardsCatalogSyncCronService,
    RewardsClaimCronService,
    {
      provide: NombaCheckoutAdapter,
      useFactory: (nombaApi: NombaApiService) => new NombaCheckoutAdapter(nombaApi),
      inject: [NombaApiService],
    },
  ],
  exports: [RewardsService, TenantWalletService, TenantWalletTopupService],
})
export class RewardsModule {}
