import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { LeaveBalanceController } from './leave-balance.controller';
import { LeaveBalanceRepository } from './leave-balance.repository';
import { LeaveBalanceService } from './leave-balance.service';
import { TenantsModule } from '../tenants/tenants.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
import { LeaveBalanceInitializationService } from './leave-balance-initialization.service';
import { LeaveTypeModule } from '../leave-type/leave-type.module';
import { LeaveBalance } from "./entities/leave-balance.entity";
import { TenantMember } from "../tenant-members/entities/tenant-member.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalance, TenantMember]),
    TenantsModule,
    TenantMembersModule,
    LeavePolicyModule,
    forwardRef(() => LeaveTypeModule),
  ],
  controllers: [LeaveBalanceController],
  providers: [
    LeaveBalanceService,
    LeaveBalanceRepository,
    LeaveBalanceInitializationService,
  ],
  exports: [LeaveBalanceService, LeaveBalanceInitializationService],
})
export class LeaveBalanceModule {}
