import { forwardRef, Module } from '@nestjs/common';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayrollModule } from '../payroll/payroll.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WebhooksController } from './controllers/webhooks.controller';
import { BachsWebhookService } from './services/bachs-webhook.service';
import { FincraWebhookService } from './services/fincra-webhook.service';
import { MonnifyWebhookService } from './services/monnify-webhook.service';
import { NoahWebhookService } from './services/noah-webhook.service';
import { NombaWebhookService } from './services/nomba-webhook.service';
import { PolarWebhookService } from './services/polar-webhook.service';
import { TremendousWebhookService } from './services/tremendous-webhook.service';

@Module({
  imports: [
    forwardRef(() => SubscriptionsModule),
    PayrollModule,
    RewardsModule,
    ShoutoutsModule,
    PaymentsModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [WebhooksController],
  providers: [
    NombaWebhookService,
    MonnifyWebhookService,
    NoahWebhookService,
    FincraWebhookService,
    BachsWebhookService,
    PolarWebhookService,
    TremendousWebhookService,
  ],
})
export class WebhooksModule {}
