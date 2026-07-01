import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { ReloadlyApiService } from 'src/common/services/reloadly-api.service';
import { ReloadlyTopupsApiService } from 'src/common/services/reloadly-topups-api.service';
import { ReloadlyUtilitiesApiService } from 'src/common/services/reloadly-utilities-api.service';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { RewardsController } from './controllers/rewards.controller';
import { RewardsAdminController } from './controllers/rewards-admin.controller';
import { CustomReward } from './entities/custom-reward.entity';
import { MisdirectedDeposit } from './entities/misdirected-deposit.entity';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { Task } from './entities/task.entity';
import { TaskSubmission } from './entities/task-submission.entity';
import { TenantWallet } from './entities/tenant-wallet.entity';
import { TenantWalletTransaction } from './entities/tenant-wallet-transaction.entity';
import { RewardsListener } from './listeners/rewards.listener';
import { CustomRewardsService } from './services/custom-rewards.service';
import { RewardsWalletVaCronService } from './services/rewards-wallet-va-cron.service';
import { RewardsService } from './services/rewards.service';
import { TenantWalletService } from './services/tenant-wallet.service';
import { ReloadlyWebhookService } from './services/reloadly-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantWallet,
      TenantWalletTransaction,
      MisdirectedDeposit,
      CustomReward,
      RewardRedemption,
      Task,
      TaskSubmission,
      Tenant,
    ]),
    PaymentsModule,
    TenantSettingsModule,
    SubscriptionsModule,
    ShoutoutsModule,
  ],
  controllers: [RewardsController, RewardsAdminController],
  providers: [
    RewardsService,
    TenantWalletService,
    CustomRewardsService,
    ReloadlyWebhookService,
    ReloadlyApiService,
    ReloadlyTopupsApiService,
    ReloadlyUtilitiesApiService,
    NombaBillApiService,
    RewardsListener,
    RewardsWalletVaCronService,
  ],
  exports: [RewardsService, TenantWalletService, ReloadlyWebhookService],
})
export class RewardsModule {}
