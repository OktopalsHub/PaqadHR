import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureAccessGuard } from '../../../common/guards/feature-access.guard';
import { PlansModule } from '../plans/plans.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsAdminController } from './controllers/subscriptions-admin.controller';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { NombaService } from './services/nomba.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSubscription, Tenant]),
    PlansModule,
    TenantMembersModule,
  ],
  controllers: [SubscriptionsController, SubscriptionsAdminController],
  providers: [SubscriptionsService, NombaService, FeatureAccessGuard],
  exports: [SubscriptionsService, FeatureAccessGuard],
})
export class SubscriptionsModule {}
