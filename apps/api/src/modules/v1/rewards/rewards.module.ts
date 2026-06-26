import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { ReloadlyApiService } from 'src/common/services/reloadly-api.service';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { RewardsController } from './controllers/rewards.controller';
import { CustomReward } from './entities/custom-reward.entity';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { TenantWallet } from './entities/tenant-wallet.entity';
import { TenantWalletTransaction } from './entities/tenant-wallet-transaction.entity';
import { Task } from './entities/task.entity';
import { TaskSubmission } from './entities/task-submission.entity';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { CustomRewardsService } from './services/custom-rewards.service';
import { RewardsService } from './services/rewards.service';
import { TenantWalletService } from './services/tenant-wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantWallet,
      TenantWalletTransaction,
      CustomReward,
      RewardRedemption,
      Task,
      TaskSubmission,
    ]),
    TenantSettingsModule,
    SubscriptionsModule,
    ShoutoutsModule,
  ],
  controllers: [RewardsController],
  providers: [
    RewardsService,
    TenantWalletService,
    CustomRewardsService,
    ReloadlyApiService,
    NombaBillApiService,
    NombaTransferApiService,
  ],
  exports: [RewardsService, TenantWalletService],
})
export class RewardsModule {}
