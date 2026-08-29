import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerAccessModule } from 'src/common/modules/manager-access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { LeaveBalanceModule } from '../leave-balance/leave-balance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { Leave } from './entities/leave.entity';
import { LeaveController } from './leave.controller';
import { LeaveRepository } from './leave.repository';
import { LeaveService } from './leave.service';
import { LeaveAuthorizationService } from './services/leave-authorization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Leave]),
    ManagerAccessModule,
    TenantsModule,
    TenantMembersModule,
    TenantSettingsModule,
    LeaveBalanceModule,
    ActivitiesModule,
    NotificationsModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveRepository, LeaveAuthorizationService],
  exports: [LeaveService, LeaveAuthorizationService],
})
export class LeaveModule {}
