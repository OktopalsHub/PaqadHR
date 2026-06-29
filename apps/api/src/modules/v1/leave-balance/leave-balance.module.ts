import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
import { LeaveTypeModule } from '../leave-type/leave-type.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveAssignmentController } from './leave-assignment.controller';
import { LeaveBalanceController } from './leave-balance.controller';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveBalanceInitializationService } from './leave-balance-initialization.service';
import { LeaveTypeAssignmentService } from './leave-type-assignment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalance, TenantMember]),
    TenantsModule,
    TenantMembersModule,
    LeavePolicyModule,
    LeaveTypeModule,
  ],
  controllers: [LeaveBalanceController, LeaveAssignmentController],
  providers: [
    LeaveBalanceService,
    LeaveBalanceRepository,
    LeaveBalanceInitializationService,
    LeaveTypeAssignmentService,
  ],
  exports: [LeaveBalanceService, LeaveBalanceInitializationService],
})
export class LeaveBalanceModule {}
