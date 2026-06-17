import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureAccessGuard } from '../../../common/guards/feature-access.guard';
import { PlansModule } from '../plans/plans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionBillingController } from './controllers/subscription-billing.controller';
import { SubscriptionWebhooksController } from './controllers/subscription-webhooks.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsAdminController } from './controllers/subscriptions-admin.controller';
import { BillingEvent } from './entities/billing-event.entity';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { BillingGatewayGuard } from './guards/billing-gateway.guard';
import { SubscriptionBillingListener } from './listeners/subscription-billing.listener';
import { NombaSubscriptionProvider } from './providers/nomba-subscription.provider';
import { BillingCronService } from './services/billing-cron.service';
import { NombaApiService } from './services/nomba-api.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSubscription, Tenant, User, TenantMember, BillingEvent]),
    PlansModule,
    NotificationsModule,
    TenantMembersModule,
  ],
  controllers: [
    SubscriptionsController,
    SubscriptionsAdminController,
    SubscriptionBillingController,
    SubscriptionWebhooksController,
  ],
  providers: [
    SubscriptionsService,
    SubscriptionBillingService,
    BillingCronService,
    SubscriptionBillingListener,
    NombaApiService,
    NombaSubscriptionProvider,
    BillingGatewayGuard,
    FeatureAccessGuard,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionBillingService,
    NombaSubscriptionProvider,
    FeatureAccessGuard,
  ],
})
export class SubscriptionsModule {}
