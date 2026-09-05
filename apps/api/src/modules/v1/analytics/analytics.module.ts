import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceModule } from '../attendance/attendance.module';
import { Department } from '../departments/entities/department.entity';
import { DepartmentMember } from '../departments/entities/department-member.entity';
import { Leave } from '../leave/entities/leave.entity';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { Candidate } from '../recruitment/entities/candidate.entity';
import { JobOpening } from '../recruitment/entities/job-opening.entity';
import { Shoutout } from '../shoutouts/entities/shoutout.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantMember,
      Leave,
      JobOpening,
      Candidate,
      PayrollRun,
      Department,
      DepartmentMember,
      Shoutout,
    ]),
    forwardRef(() => TenantMembersModule),
    AttendanceModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
