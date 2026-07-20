import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { FeatureAccessGuard } from '../../../common/guards/feature-access.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlansModule } from '../plans/plans.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
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
import { NoahSubscriptionProvider } from './providers/noah-subscription.provider';
import { NombaSubscriptionProvider } from './providers/nomba-subscription.provider';
import { BillingCronService } from './services/billing-cron.service';
import { BillingProviderFactoryService } from './services/billing-provider-factory.service';
import { NombaApiService } from './services/nomba-api.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSubscription, Tenant, User, TenantMember, BillingEvent]),
    PaymentsModule,
    PlansModule,
    NotificationsModule,
    TenantMembersModule,
    TenantConfigModule,
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
    NoahSubscriptionProvider,
    BillingProviderFactoryService,
    BillingGatewayGuard,
    FeatureAccessGuard,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionBillingService,
    NombaSubscriptionProvider,
    NoahSubscriptionProvider,
    BillingProviderFactoryService,
    NombaApiService,
    FeatureAccessGuard,
  ],
})
export class SubscriptionsModule {}
