import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LeaveManagementListener } from './leave-management.listener';
import { LeaveTypeModule } from "../../leave-type/leave-type.module";
import { LeavePolicyModule } from "../../leave-policy/leave-policy.module";
import { LeaveBalanceModule } from "../../leave-balance/leave-balance.module";
import { TenantMembersModule } from "../../tenant-members/tenant-members.module";

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    LeaveTypeModule,
    LeavePolicyModule,
    LeaveBalanceModule,
    TenantMembersModule,
  ],
  providers: [LeaveManagementListener],
})
export class LeaveManagementModule {}
