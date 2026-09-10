import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { DepartmentMember } from '../departments/entities/department-member.entity';
import { LeaveModule } from '../leave/leave.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AttendanceService } from './attendance.service';
import { AttendanceClockController } from './attendance-clock.controller';
import { AttendanceReportsController } from './attendance-reports.controller';
import { Attendance } from './entities/attendance.entity';
import { AttendanceException } from './entities/attendance-exception.entity';
import { AttendancePolicy } from './entities/attendance-policy.entity';
import { AttendanceRepository } from './repositories/attendance.repository';
import { AttendanceExceptionRepository } from './repositories/attendance-exception.repository';
import { AttendancePolicyRepository } from './repositories/attendance-policy.repository';
import { AttendanceClockService } from './services/attendance-clock.service';
import { AttendanceEligibilityService } from './services/attendance-eligibility.service';
import { AttendanceExceptionService } from './services/attendance-exception.service';
import { AttendancePolicyService } from './services/attendance-policy.service';
import { AttendanceReportService } from './services/attendance-report.service';
import { AttendanceSessionService } from './services/attendance-session.service';
import { DepartmentUtils } from './utils/department.utils';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, AttendancePolicy, AttendanceException, DepartmentMember]),
    TenantsModule,
    TenantMembersModule,
    TenantSettingsModule,
    LeaveModule,
    ActivitiesModule,
    NotificationsModule,
  ],
  controllers: [AttendanceClockController, AttendanceReportsController],
  providers: [
    AttendanceService,
    AttendanceRepository,
    AttendancePolicyRepository,
    AttendanceExceptionRepository,
    DepartmentUtils,
    AttendancePolicyService,
    AttendanceClockService,
    AttendanceEligibilityService,
    AttendanceExceptionService,
    AttendanceReportService,
    AttendanceSessionService,
  ],
  exports: [
    AttendanceService,
    AttendancePolicyService,
    AttendanceClockService,
    AttendanceEligibilityService,
    AttendanceExceptionService,
    AttendanceReportService,
    AttendanceSessionService,
  ],
})
export class AttendanceModule {}
