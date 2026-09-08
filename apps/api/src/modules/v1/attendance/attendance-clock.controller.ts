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
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest, MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AttendanceService } from './attendance.service';
import { AttendanceControllerHelpers, getDeviceType } from './attendance-controller-helpers';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@ApiTags('Attendance')
@Controller('tenants/:tenantId/attendance')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.ATTENDANCE)
export class AttendanceClockController {
  private readonly helpers: AttendanceControllerHelpers;
  constructor(
    private readonly attendanceService: AttendanceService,
    readonly managerAccessService: ManagerAccessService,
  ) {
    this.helpers = new AttendanceControllerHelpers(managerAccessService, attendanceService);
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
      deviceType: getDeviceType(req.headers['user-agent'] ?? ''),
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
    return this.attendanceService.getClockInInfo(
      tenantId,
      member.id,
      date ? new Date(date) : new Date(),
    );
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
    return this.helpers.getAttendanceRecords(
      tenantId,
      employeeId,
      startDate,
      endDate,
      status,
      view,
      month,
      year,
      page,
      limit,
      member,
    );
  }

  @Get(':attendanceId')
  async getAttendance(
    @Param('tenantId') tenantId: string,
    @Param('attendanceId') attendanceId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const attendance = await this.attendanceService.getAttendance(tenantId, attendanceId);
    if (!attendance.member?.id) {
      throw new ForbiddenException('You can only view your own attendance records');
    }
    await this.helpers.assertCanViewEmployee(member, tenantId, attendance.member.id);
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

  @Post('bulk')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  bulkCreateAttendance(
    @Param('tenantId') tenantId: string,
    @Body() dto: {
      records: Array<{ memberId: string; date: string; status: string; notes?: string }>;
    },
  ) {
    return this.attendanceService.bulkCreateAttendance(tenantId, dto.records);
  }

  @Post('manual')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @RequireFeatures(FeatureAccess.ADVANCED_ATTENDANCE)
  createManualAttendance(
    @Param('tenantId') tenantId: string,
    @Body() dto: {
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
}
