import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { LeaveTypeController } from './controllers/leave-type.controller';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveTypeRepository } from './leave-type.repository';
import { LeaveTypeService } from './leave-type.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveType]),
    forwardRef(() => TenantsModule),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => ActivitiesModule),
  ],
  controllers: [LeaveTypeController],
  providers: [LeaveTypeService, LeaveTypeRepository],
  exports: [LeaveTypeService],
})
export class LeaveTypeModule {}
