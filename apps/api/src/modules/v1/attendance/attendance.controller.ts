import { Attendance } from './entities/attendance.entity';
import {
  Body,
  Controller,
  Delete,
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
import {
  IAuthenticatedMemberRequest,
  MemberContext,
} from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AttendanceService } from './attendance.service';
import { DateValidationUtil } from './utils/date-validation.util';
import { ClockInDto } from "./dto/clock-in.dto";
import { ClockOutDto } from "./dto/clock-out.dto";
import { CreateAttendancePolicyDto } from "./dto/create-attendance-policy.dto";
import { UpdateAttendancePolicyDto } from "./dto/update-attendance-policy.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";
import { CreateAttendanceExceptionDto } from "./dto/create-attendance-exception.dto";
import { ApproveAttendanceExceptionDto } from "./dto/approve-attendance-exception.dto";
import { RejectAttendanceExceptionDto } from "./dto/reject-attendance-exception.dto";

@ApiTags('Attendance')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}
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
    return this.attendanceService.clockOut(
      tenantId,
      member.id,
      attendanceId,
      dto,
    );
  }
  @Post('policies')
    createAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAttendancePolicyDto,
  ) {
    return this.attendanceService.createAttendancePolicy(tenantId, dto);
  }
  @Get('policies') getAttendancePolicies(@Param('tenantId') tenantId: string) {
    return this.attendanceService.getAttendancePolicies(tenantId);
  }
  @Get('policies/:policyId') getAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Param('policyId') policyId: string,
  ) {
    return this.attendanceService.getAttendancePolicy(tenantId, policyId);
  }
  @Patch('policies/:policyId')
    updateAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateAttendancePolicyDto,
  ) {
    return this.attendanceService.updateAttendancePolicy(
      tenantId,
      policyId,
      dto,
    );
  }
  @Delete('policies/:policyId')
    deleteAttendancePolicy(
    @Param('tenantId') tenantId: string,
    @Param('policyId') policyId: string,
  ) {
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
    return this.attendanceService.getClockInInfo(
      tenantId,
      member.id,
      targetDate,
    );
  }
  @Get('stats')
  async getAttendanceStats(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    return this.attendanceService.getAttendanceStats(tenantId, start, end);
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
  ) {
    if (view === 'monthly') {
      const currentDate = new Date();
      const defaultMonth = currentDate.getMonth() + 1;
      const defaultYear = currentDate.getFullYear();
      const targetMonth = month
        ? DateValidationUtil.validateMonth(month)
        : defaultMonth;
      const targetYear = year
        ? DateValidationUtil.validateYear(year)
        : defaultYear;
      if (month && year) {
        DateValidationUtil.validateMonthYear(targetMonth, targetYear);
      }
      const pageNumber = page ? parseInt(page) : 1;
      const limitNumber = limit ? parseInt(limit) : 10;
      return this.attendanceService.getMonthlyAttendanceForAllMembers(
        tenantId,
        targetMonth,
        targetYear,
        pageNumber,
        limitNumber,
      );
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
  @Get(':attendanceId') getAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.attendanceService.getAttendance(tenantId, attendanceId);
  }
  @Patch(':attendanceId')
    updateAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.updateAttendance(tenantId, attendanceId, dto);
  }
  @Post('exceptions')
    createAttendanceException(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.attendanceService.createAttendanceException(
      tenantId,
      member.id,
      dto,
    );
  }
  @Get('exceptions') getAttendanceExceptions(
    @Param('tenantId') tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
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
    return this.attendanceService.getAttendanceExceptions(tenantId, filters);
  }
  @Get('exceptions/:exceptionId') getAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
  ) {
    return this.attendanceService.getAttendanceException(
      tenantId,
      exceptionId,
    );
  }
  @Patch('exceptions/:exceptionId/approve')
    approveAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: ApproveAttendanceExceptionDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.attendanceService.approveAttendanceException(
      tenantId,
      exceptionId,
      member.id,
      dto,
    );
  }
  @Patch('exceptions/:exceptionId/reject')
    rejectAttendanceException(
    @Param('tenantId') tenantId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: RejectAttendanceExceptionDto,
  ) {
    return this.attendanceService.rejectAttendanceException(
      tenantId,
      exceptionId,
      dto,
    );
  }
  @Get('reports/daily') getDailyAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Query('date') date: string,
  ) {
    const reportDate = date ? new Date(date) : new Date();
    return this.attendanceService.getDailyAttendanceReport(
      tenantId,
      reportDate,
    );
  }
  @Get('reports/monthly') getMonthlyAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const currentDate = new Date();
    const defaultMonth = currentDate.getMonth() + 1;
    const defaultYear = currentDate.getFullYear();
    const monthNum = month
      ? DateValidationUtil.validateMonth(month)
      : defaultMonth;
    const yearNum = year ? DateValidationUtil.validateYear(year) : defaultYear;
    if (month && year) {
      DateValidationUtil.validateMonthYear(monthNum, yearNum);
    }
    return this.attendanceService.getMonthlyAttendanceReport(
      tenantId,
      monthNum,
      yearNum,
    );
  }
  @Get('reports/employee/:employeeId') getEmployeeAttendanceReport(
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    return this.attendanceService.getEmployeeAttendanceReport(
      tenantId,
      employeeId,
      start,
      end,
    );
  }
  @Post('bulk')
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
    return this.attendanceService.createManualAttendance(
      tenantId,
      dto.tenantMemberId,
      {
        date: new Date(dto.date),
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        status: dto.status,
        location: dto.location,
        notes: dto.notes,
      },
    );
  }
  @Delete(':attendanceId')
    deleteAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.attendanceService.deleteAttendance(tenantId, attendanceId);
  }
  @Get('session-limit')
  async getSessionLimit(@Param('tenantId') tenantId: string) {
    try {
      const limit = await this.attendanceService.getSessionLimit(tenantId);
      return { maxSessionsPerDay: limit };
    } catch (error) {
      throw error;
    }
  }
  @Get('session-count')
  async getCurrentSessionCount(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('date') date?: string,
  ) {
    try {
      const targetDate = date ? new Date(date) : new Date();
      const count = await this.attendanceService.getCurrentSessionCount(
        tenantId,
        member.id,
        targetDate,
      );
      return { sessionCount: count };
    } catch (error) {
      throw error;
    }
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
