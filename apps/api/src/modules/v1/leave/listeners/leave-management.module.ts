import { Module } from '@nestjs/common';
import { LeaveManagementListener } from './leave-management.listener';
import { LeaveTypeModule } from "../../leave-type/leave-type.module";
import { LeavePolicyModule } from "../../leave-policy/leave-policy.module";
import { LeaveBalanceModule } from "../../leave-balance/leave-balance.module";
import { TenantMembersModule } from "../../tenant-members/tenant-members.module";

@Module({
  imports: [
    LeaveTypeModule,
    LeavePolicyModule,
    LeaveBalanceModule,
    TenantMembersModule,
  ],
  providers: [LeaveManagementListener],
  exports: [LeaveManagementListener],
})
export class LeaveManagementModule {}
