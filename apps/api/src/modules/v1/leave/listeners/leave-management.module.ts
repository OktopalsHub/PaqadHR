import { forwardRef, Module } from '@nestjs/common';
import { LeaveBalanceModule } from '../../leave-balance/leave-balance.module';
import { LeavePolicyModule } from '../../leave-policy/leave-policy.module';
import { LeaveTypeModule } from '../../leave-type/leave-type.module';
import { TenantMembersModule } from '../../tenant-members/tenant-members.module';
import { LeaveManagementListener } from './leave-management.listener';

@Module({
  imports: [
    LeaveTypeModule,
    LeavePolicyModule,
    LeaveBalanceModule,
    forwardRef(() => TenantMembersModule),
  ],
  providers: [LeaveManagementListener],
  exports: [LeaveManagementListener],
})
export class LeaveManagementModule {}
