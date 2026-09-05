import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { FeatureAccessGuard } from '../../../common/guards/feature-access.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanPrice } from '../plans/entities/plan-price.entity';
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
import { BachsSubscriptionProvider } from './providers/bachs-subscription.provider';
import { MonnifySubscriptionProvider } from './providers/monnify-subscription.provider';
import { NombaSubscriptionProvider } from './providers/nomba-subscription.provider';
import { PolarSubscriptionProvider } from './providers/polar-subscription.provider';
import { BillingCronService } from './services/billing-cron.service';
import { BillingProductSyncService } from './services/billing-product-sync.service';
import { BillingProviderFactoryService } from './services/billing-provider-factory.service';
import { NombaApiService } from './services/nomba-api.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantSubscription,
      Tenant,
      User,
      TenantMember,
      BillingEvent,
      PlanPrice,
    ]),
    PaymentsModule,
    PlansModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => TenantMembersModule),
    TenantConfigModule,
    AuditLogsModule,
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
    BillingProductSyncService,
    SubscriptionBillingListener,
    NombaApiService,
    NombaSubscriptionProvider,
    MonnifySubscriptionProvider,
    BachsSubscriptionProvider,
    PolarSubscriptionProvider,
    BillingProviderFactoryService,
    BillingGatewayGuard,
    FeatureAccessGuard,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionBillingService,
    BillingProductSyncService,
    NombaSubscriptionProvider,
    MonnifySubscriptionProvider,
    BachsSubscriptionProvider,
    PolarSubscriptionProvider,
    BillingProviderFactoryService,
    NombaApiService,
    FeatureAccessGuard,
  ],
})
export class SubscriptionsModule {}
