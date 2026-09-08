import { Module } from '@nestjs/common';
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
import { BachsProductSyncService } from './services/bachs-product-sync.service';
import { BillingCronService } from './services/billing-cron.service';
import { BillingEventStore } from './services/billing-event-store';
import { BillingOverviewService } from './services/billing-overview.service';
import { BillingProductSyncService } from './services/billing-product-sync.service';
import { BillingProviderFactoryService } from './services/billing-provider-factory.service';
import { NombaApiService } from './services/nomba-api.service';
import { PaymentSuccessHandlers } from './services/payment-success-handlers';
import { PaymentVerifier } from './services/payment-verifier';
import { PolarProductSyncService } from './services/polar-product-sync.service';
import { RenewalLifecycleService } from './services/renewal-lifecycle.service';
import { RenewalProcessor } from './services/renewal-processor';
import { RenewalSuccessApplicator } from './services/renewal-success-applicator';
import { SeatPricingCalculator } from './services/seat-pricing-calculator';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionCheckoutService } from './services/subscription-checkout.service';
import { SubscriptionEntitlementService } from './services/subscription-entitlement.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionRegionService } from './services/subscription-region.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { WebhookDispatcher } from './services/webhook-dispatcher';
import { WebhookEventResolver } from './services/webhook-event-resolver';

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
    NotificationsModule,
    TenantMembersModule,
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
    SubscriptionEntitlementService,
    SubscriptionLifecycleService,
    SubscriptionRegionService,
    SeatPricingCalculator,
    RenewalProcessor,
    RenewalLifecycleService,
    RenewalSuccessApplicator,
    WebhookDispatcher,
    WebhookEventResolver,
    BillingEventStore,
    PaymentVerifier,
    PaymentSuccessHandlers,
    SubscriptionBillingService,
    SubscriptionCheckoutService,
    BillingOverviewService,
    BillingCronService,
    BillingProductSyncService,
    BachsProductSyncService,
    PolarProductSyncService,
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
    SubscriptionEntitlementService,
    SubscriptionLifecycleService,
    SubscriptionRegionService,
    SubscriptionBillingService,
    SeatPricingCalculator,
    RenewalProcessor,
    RenewalLifecycleService,
    RenewalSuccessApplicator,
    WebhookDispatcher,
    WebhookEventResolver,
    BillingEventStore,
    PaymentVerifier,
    PaymentSuccessHandlers,
    BillingProductSyncService,
    SubscriptionCheckoutService,
    BillingOverviewService,
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
