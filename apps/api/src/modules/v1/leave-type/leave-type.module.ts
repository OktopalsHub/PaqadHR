import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { LeaveTypeController } from './controllers/leave-type.controller';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveTypeRepository } from './leave-type.repository';
import { LeaveTypeService } from './leave-type.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType]), TenantsModule, TenantMembersModule],
  controllers: [LeaveTypeController],
  providers: [LeaveTypeService, LeaveTypeRepository],
  exports: [LeaveTypeService],
})
export class LeaveTypeModule {}
