import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansModule } from '../plans/plans.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsAdminController } from './controllers/subscriptions-admin.controller';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { NombaService } from './services/nomba.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { FeatureAccessGuard } from '../../../common/guards/feature-access.guard';

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
