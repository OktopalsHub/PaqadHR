import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AttendanceService } from './attendance.service';
import { AttendanceControllerHelpers } from './attendance-controller-helpers';
import { ApproveAttendanceExceptionDto } from './dto/approve-attendance-exception.dto';
import { CreateAttendanceExceptionDto } from './dto/create-attendance-exception.dto';
import { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import { RejectAttendanceExceptionDto } from './dto/reject-attendance-exception.dto';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';

@ApiTags('Attendance')
@Controller('tenants/:tenantId/attendance')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.ATTENDANCE)
export class AttendanceReportsController {
  private readonly helpers: AttendanceControllerHelpers;
  constructor(
    private readonly attendanceService: AttendanceService,
    readonly managerAccessService: ManagerAccessService,
  ) {
    this.helpers = new AttendanceControllerHelpers(managerAccessService, attendanceService);
  }

  @Post('policies')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  createAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAttendancePolicyDto,
  ) {
    return this.helpers.createPolicy(tenantId, dto);
  }

  @Get('policies')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  getAttendancePolicies(@Param('tenantId') tenantId: string) {
    return this.helpers.getPolicies(tenantId);
  }

  @Get('policies/:policyId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  getAttendancePolicy(@Param('tenantId') tenantId: string, @Param('policyId') policyId: string) {
    return this.helpers.getPolicy(tenantId, policyId);
  }

  @Patch('policies/:policyId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  updateAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateAttendancePolicyDto,
  ) {
    return this.helpers.updatePolicy(tenantId, policyId, dto);
  }

  @Delete('policies/:policyId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  deleteAttendancePolicy(@Param('tenantId') tenantId: string, @Param('policyId') policyId: string) {
    return this.helpers.deletePolicy(tenantId, policyId);
  }

  @Get('stats')
  async getAttendanceStats(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentTenantMember() member?: MemberContext,
  ) {
    return this.attendanceService.getAttendanceStats(
      tenantId,
      startDate ? new Date(startDate) : new Date(),
      endDate ? new Date(endDate) : new Date(),
    );
  }

  @Post('exceptions')
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  createAttendanceException(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.attendanceService.createAttendanceException(tenantId, member.id, dto);
  }

  @Get('exceptions')
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  async getAttendanceExceptions(
    @Param('tenantId') tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @CurrentTenantMember() member?: MemberContext,
  ) {
    const filters = await this.helpers.buildFiltersForExceptions(
      member!,
      tenantId,
      employeeId,
      startDate,
      endDate,
      status,
    );
    return this.attendanceService.getAttendanceExceptions(tenantId, filters);
  }

  @Get('exceptions/:exceptionId')
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  async getAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.helpers.assertCanViewEmployee(member, tenantId, exception.tenantMemberId);
    return exception;
  }

  @Patch('exceptions/:exceptionId/approve')
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  async approveAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: ApproveAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.helpers.assertCanApproveException(member, tenantId, exception.tenantMemberId);
    return this.attendanceService.approveAttendanceException(tenantId, exceptionId, member.id, dto);
  }

  @Patch('exceptions/:exceptionId/reject')
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  async rejectAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: RejectAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.helpers.assertCanApproveException(member, tenantId, exception.tenantMemberId);
    return this.attendanceService.rejectAttendanceException(tenantId, exceptionId, dto, member.id);
  }

  @Get('reports/daily')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  getDailyAttendanceReport(@Param('tenantId') tenantId: string, @Query('date') date: string) {
    return this.attendanceService.getDailyAttendanceReport(
      tenantId,
      date ? new Date(date) : new Date(),
    );
  }

  @Get('reports/monthly')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  getMonthlyAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.helpers.getMonthlyAttendanceReport(tenantId, month, year);
  }

  @Get('reports/employee/:employeeId')
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  async getEmployeeAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.helpers.assertCanViewEmployee(member, tenantId, employeeId);
    return this.attendanceService.getEmployeeAttendanceReport(
      tenantId,
      employeeId,
      startDate ? new Date(startDate) : new Date(),
      endDate ? new Date(endDate) : new Date(),
    );
  }
}
