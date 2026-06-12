import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceModule } from '../leave-balance/leave-balance.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { LeaveTypeAssignmentService } from './leave-type-assignment.service';
import { LeaveTypeRepository } from './leave-type.repository';
import { LeaveTypeService } from './leave-type.service';
import { LeaveType } from "./entities/leave-type.entity";
import { LeaveTypeController } from "./controllers/leave-type.controller";
import { LeaveAssignmentController } from "./controllers/leave-assignment.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveType]),
    TenantsModule,
    TenantMembersModule,
    forwardRef(() => LeaveBalanceModule),
  ],
  controllers: [LeaveTypeController, LeaveAssignmentController],
  providers: [
    LeaveTypeService,
    LeaveTypeAssignmentService,
    LeaveTypeRepository,
  ],
  exports: [LeaveTypeService],
})
export class LeaveTypeModule {}
