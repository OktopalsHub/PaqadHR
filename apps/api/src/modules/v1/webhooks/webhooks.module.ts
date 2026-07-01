import { Module } from '@nestjs/common';
import { PayrollModule } from '../payroll/payroll.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WebhooksController } from './controllers/webhooks.controller';
import { NombaWebhookService } from './services/nomba-webhook.service';

@Module({
  imports: [SubscriptionsModule, PayrollModule, RewardsModule, ShoutoutsModule],
  controllers: [WebhooksController],
  providers: [NombaWebhookService],
})
export class WebhooksModule {}
