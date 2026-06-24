import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest, MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { assertAdmin, isTenantAdmin } from 'src/common/utils/member-access.util';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AttendanceService } from './attendance.service';
import type { ApproveAttendanceExceptionDto } from './dto/approve-attendance-exception.dto';
import type { ClockInDto } from './dto/clock-in.dto';
import type { ClockOutDto } from './dto/clock-out.dto';
import type { CreateAttendanceExceptionDto } from './dto/create-attendance-exception.dto';
import type { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import type { RejectAttendanceExceptionDto } from './dto/reject-attendance-exception.dto';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto';
import type { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import { DateValidationUtil } from './utils/date-validation.util';

@ApiTags('Attendance')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly managerAccessService: ManagerAccessService,
  ) {}

  private async assertCanViewEmployee(
    member: MemberContext,
    tenantId: string,
    employeeId: string,
  ): Promise<void> {
    if (employeeId === member.id || isTenantAdmin(member)) {
      return;
    }
    await this.managerAccessService.assertAdminOrManagerOf(member, employeeId, tenantId);
  }

  private async assertCanApproveException(
    member: MemberContext,
    tenantId: string,
    submitterId: string,
  ): Promise<void> {
    if (submitterId === member.id) {
      throw new ForbiddenException('You cannot approve your own attendance exception');
    }
    await this.managerAccessService.assertAdminOrManagerOf(member, submitterId, tenantId);
  }

  @Post('clock-in')
  async clockIn(
    @Param('tenantId') tenantId: string,
    @Body() dto: ClockInDto,
    @CurrentTenantMember() member: MemberContext,
    @Req() req: IAuthenticatedMemberRequest,
  ) {
    const metadata = {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceType: this.getDeviceType(req.headers['user-agent'] ?? ''),
      entryMethod: 'api',
    };
    return this.attendanceService.clockIn(tenantId, member.id, dto, metadata);
  }

  @Patch('clock-out/:attendanceId')
  clockOut(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
    @Body() dto: ClockOutDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.attendanceService.clockOut(tenantId, member.id, attendanceId, dto);
  }

  @Post('policies')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  createAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAttendancePolicyDto,
  ) {
    return this.attendanceService.createAttendancePolicy(tenantId, dto);
  }

  @Get('policies')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  getAttendancePolicies(@Param('tenantId') tenantId: string) {
    return this.attendanceService.getAttendancePolicies(tenantId);
  }

  @Get('policies/:policyId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  getAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Param('policyId') policyId: string,
  ) {
    return this.attendanceService.getAttendancePolicy(tenantId, policyId);
  }

  @Patch('policies/:policyId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  updateAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateAttendancePolicyDto,
  ) {
    return this.attendanceService.updateAttendancePolicy(tenantId, policyId, dto);
  }

  @Delete('policies/:policyId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  deleteAttendancePolicy(@Param('tenantId') tenantId: string, @Param('policyId') policyId: string) {
    return this.attendanceService.deleteAttendancePolicy(tenantId, policyId);
  }

  @Get('today')
  async getTodayAttendance(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.attendanceService.getTodayAttendance(tenantId, member.id);
  }

  @Get('clock-in-info')
  async getClockInInfo(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return this.attendanceService.getClockInInfo(tenantId, member.id, targetDate);
  }

  @Get('stats')
  async getAttendanceStats(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentTenantMember() member?: MemberContext,
  ) {
    assertAdmin(member!);
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    return this.attendanceService.getAttendanceStats(tenantId, start, end);
  }

  @Post('exceptions')
  createAttendanceException(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.attendanceService.createAttendanceException(tenantId, member.id, dto);
  }

  @Get('exceptions')
  async getAttendanceExceptions(
    @Param('tenantId') tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @CurrentTenantMember() member?: MemberContext,
  ) {
    const filters: {
      tenantMemberId?: string;
      tenantMemberIds?: string[];
      startDate?: Date;
      endDate?: Date;
      status?: string;
    } = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (status) filters.status = status;

    if (employeeId) {
      await this.assertCanViewEmployee(member!, tenantId, employeeId);
      filters.tenantMemberId = employeeId;
    } else if (isTenantAdmin(member!)) {
      // admin sees all
    } else {
      const directReports = await this.managerAccessService.getDirectReportIds(
        tenantId,
        member!.id,
      );
      if (directReports.length === 0) {
        throw new ForbiddenException('Admin or manager access required');
      }
      filters.tenantMemberIds = directReports;
    }

    return this.attendanceService.getAttendanceExceptions(tenantId, filters);
  }

  @Get('exceptions/:exceptionId')
  async getAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.assertCanViewEmployee(member, tenantId, exception.tenantMemberId);
    return exception;
  }

  @Patch('exceptions/:exceptionId/approve')
  async approveAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: ApproveAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.assertCanApproveException(member, tenantId, exception.tenantMemberId);
    return this.attendanceService.approveAttendanceException(
      tenantId,
      exceptionId,
      member.id,
      dto,
    );
  }

  @Patch('exceptions/:exceptionId/reject')
  async rejectAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: RejectAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.assertCanApproveException(member, tenantId, exception.tenantMemberId);
    return this.attendanceService.rejectAttendanceException(tenantId, exceptionId, dto);
  }

  @Get('reports/daily')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  getDailyAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Query('date') date: string,
  ) {
    const reportDate = date ? new Date(date) : new Date();
    return this.attendanceService.getDailyAttendanceReport(tenantId, reportDate);
  }

  @Get('reports/monthly')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  getMonthlyAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const currentDate = new Date();
    const defaultMonth = currentDate.getMonth() + 1;
    const defaultYear = currentDate.getFullYear();
    const monthNum = month ? DateValidationUtil.validateMonth(month) : defaultMonth;
    const yearNum = year ? DateValidationUtil.validateYear(year) : defaultYear;
    if (month && year) {
      DateValidationUtil.validateMonthYear(monthNum, yearNum);
    }
    return this.attendanceService.getMonthlyAttendanceReport(tenantId, monthNum, yearNum);
  }

  @Get('reports/employee/:employeeId')
  async getEmployeeAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.assertCanViewEmployee(member, tenantId, employeeId);
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    return this.attendanceService.getEmployeeAttendanceReport(tenantId, employeeId, start, end);
  }

  @Post('bulk')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  bulkCreateAttendance(
    @Param('tenantId') tenantId: string,
    @Body()
    dto: {
      records: Array<{
        memberId: string;
        date: string;
        status: string;
        notes?: string;
      }>;
    },
  ) {
    return this.attendanceService.bulkCreateAttendance(tenantId, dto.records);
  }

  @Post('manual')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createManualAttendance(
    @Param('tenantId') tenantId: string,
    @Body()
    dto: {
      tenantMemberId: string;
      date: string;
      clockIn?: string;
      clockOut?: string;
      status: string;
      location?: string;
      notes?: string;
    },
  ) {
    return this.attendanceService.createManualAttendance(tenantId, dto.tenantMemberId, {
      date: new Date(dto.date),
      clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
      clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
      status: dto.status,
      location: dto.location,
      notes: dto.notes,
    });
  }

  @Get('session-limit')
  async getSessionLimit(@Param('tenantId') tenantId: string) {
    const limit = await this.attendanceService.getSessionLimit(tenantId);
    return { maxSessionsPerDay: limit };
  }

  @Get('session-count')
  async getCurrentSessionCount(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    const count = await this.attendanceService.getCurrentSessionCount(
      tenantId,
      member.id,
      targetDate,
    );
    return { sessionCount: count };
  }

  @Get()
  async getAttendanceRecords(
    @Param('tenantId') tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('view') view?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentTenantMember() member?: MemberContext,
  ) {
    if (view === 'monthly') {
      const currentDate = new Date();
      const defaultMonth = currentDate.getMonth() + 1;
      const defaultYear = currentDate.getFullYear();
      const targetMonth = month ? DateValidationUtil.validateMonth(month) : defaultMonth;
      const targetYear = year ? DateValidationUtil.validateYear(year) : defaultYear;
      if (month && year) {
        DateValidationUtil.validateMonthYear(targetMonth, targetYear);
      }
      const pageNumber = page ? parseInt(page, 10) : 1;
      const limitNumber = limit ? parseInt(limit, 10) : 10;

      let memberIds: string[] | undefined;
      if (!isTenantAdmin(member!)) {
        memberIds = await this.managerAccessService.getDirectReportIds(tenantId, member!.id);
        if (memberIds.length === 0) {
          throw new ForbiddenException('Admin or manager access required');
        }
      }

      return this.attendanceService.getMonthlyAttendanceForAllMembers(
        tenantId,
        targetMonth,
        targetYear,
        pageNumber,
        limitNumber,
        memberIds,
      );
    }

    if (employeeId) {
      await this.assertCanViewEmployee(member!, tenantId, employeeId);
    } else if (!isTenantAdmin(member!)) {
      throw new ForbiddenException('Admin or manager access required');
    }

    const filters: {
      tenantMemberId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    } = {};
    if (employeeId) filters.tenantMemberId = employeeId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (status) filters.status = status;
    return this.attendanceService.getAttendanceRecords(tenantId, filters);
  }

  @Get(':attendanceId')
  async getAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const attendance = await this.attendanceService.getAttendance(tenantId, attendanceId);
    const targetMemberId = attendance.member?.id;
    if (!targetMemberId) {
      throw new ForbiddenException('You can only view your own attendance records');
    }
    await this.assertCanViewEmployee(member, tenantId, targetMemberId);
    return attendance;
  }

  @Patch(':attendanceId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  updateAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.updateAttendance(tenantId, attendanceId, dto);
  }

  @Delete(':attendanceId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  deleteAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.attendanceService.deleteAttendance(tenantId, attendanceId);
  }

  private getDeviceType(userAgent: string): string {
    if (
      userAgent.includes('Mobile') ||
      userAgent.includes('Android') ||
      userAgent.includes('iPhone')
    ) {
      return 'Mobile';
    }
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
      return 'Tablet';
    }
    return 'Desktop';
  }
}
