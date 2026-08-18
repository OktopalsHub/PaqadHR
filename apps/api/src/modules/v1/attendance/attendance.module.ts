import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { DepartmentMember } from '../departments/entities/department-member.entity';
import { LeaveModule } from '../leave/leave.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { Attendance } from './entities/attendance.entity';
import { AttendanceException } from './entities/attendance-exception.entity';
import { AttendancePolicy } from './entities/attendance-policy.entity';
import { AttendanceRepository } from './repositories/attendance.repository';
import { AttendanceExceptionRepository } from './repositories/attendance-exception.repository';
import { AttendancePolicyRepository } from './repositories/attendance-policy.repository';
import { DepartmentUtils } from './utils/department.utils';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, AttendancePolicy, AttendanceException, DepartmentMember]),
    TenantsModule,
    TenantMembersModule,
    TenantSettingsModule,
    LeaveModule,
    ActivitiesModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceRepository,
    AttendancePolicyRepository,
    AttendanceExceptionRepository,
    DepartmentUtils,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
