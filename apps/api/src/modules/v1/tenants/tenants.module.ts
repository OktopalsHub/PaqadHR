import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { UsersModule } from '../users/users.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PositionModule } from '../position/position.module';
import { TenantsController } from './tenants.controller';
import { TenantOnboardingController } from './controllers/tenant-onboarding.controller';
import { TenantsService } from './tenants.service';
import { TenantOnboardingService } from './services/tenant-onboarding.service';
import { Tenant } from './entities/tenant.entity';
import { TenantRepository } from './repositories/tenant.repository';
import { FileModule } from '../../../common/modules/file.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    TenantMembersModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
    PositionModule,
    FileModule,
  ],
  controllers: [TenantsController, TenantOnboardingController],
  providers: [TenantsService, TenantOnboardingService, TenantRepository],
  exports: [TenantsService, TenantRepository, TypeOrmModule],
})
export class TenantsModule {}
