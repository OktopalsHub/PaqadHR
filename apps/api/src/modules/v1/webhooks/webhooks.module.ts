import { Module } from '@nestjs/common';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { PayrollModule } from '../payroll/payroll.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WebhooksController } from './controllers/webhooks.controller';
import { BachsWebhookService } from './services/bachs-webhook.service';
import { NoahWebhookService } from './services/noah-webhook.service';
import { NombaWebhookService } from './services/nomba-webhook.service';
import { PolarWebhookService } from './services/polar-webhook.service';

@Module({
  imports: [SubscriptionsModule, PayrollModule, RewardsModule, ShoutoutsModule, PaymentsModule],
  controllers: [WebhooksController],
  providers: [NombaWebhookService, NoahWebhookService, BachsWebhookService, PolarWebhookService],
})
export class WebhooksModule {}
