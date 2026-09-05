import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from '../../../common/modules/file.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Employment } from '../employment/entities/employment.entity';
import { PlansModule } from '../plans/plans.module';
import { PositionModule } from '../position/position.module';
import { TenantWallet } from '../rewards/entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../rewards/entities/tenant-wallet-transaction.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { UsersModule } from '../users/users.module';
import { TenantOnboardingController } from './controllers/tenant-onboarding.controller';
import { Tenant } from './entities/tenant.entity';
import { TenantRepository } from './repositories/tenant.repository';
import { TenantOnboardingService } from './services/tenant-onboarding.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Employment, TenantWallet, TenantWalletTransaction]),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => UsersModule),
    PlansModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => PositionModule),
    FileModule,
    AuditLogsModule,
  ],
  controllers: [TenantsController, TenantOnboardingController],
  providers: [TenantsService, TenantOnboardingService, TenantRepository],
  exports: [TenantsService, TenantRepository, TypeOrmModule],
})
export class TenantsModule {}
