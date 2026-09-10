import { ForbiddenException } from '@nestjs/common';
import { AttendanceStatus } from 'src/common/enums';
import { AttendanceExceptionStatus } from 'src/common/enums/attendance-exception-status.enum';
import type { MemberContext } from 'src/common/interfaces';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { isTenantAdmin } from 'src/common/utils/member-access.util';
import type { AttendanceService } from './attendance.service';
import type { ApproveAttendanceExceptionDto } from './dto/approve-attendance-exception.dto';
import type { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import type { RejectAttendanceExceptionDto } from './dto/reject-attendance-exception.dto';
import type { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import { DateValidationUtil } from './utils/date-validation.util';

export class AttendanceControllerHelpers {
  constructor(
    private readonly managerAccessService: ManagerAccessService,
    private readonly attendanceService: AttendanceService,
  ) {}

  async assertCanViewEmployee(
    member: MemberContext,
    tenantId: string,
    employeeId: string,
  ): Promise<void> {
    if (employeeId === member.id || isTenantAdmin(member)) {
      return;
    }
    await this.managerAccessService.assertAdminOrManagerOf(member, employeeId, tenantId);
  }

  async assertCanApproveException(
    member: MemberContext,
    tenantId: string,
    submitterId: string,
  ): Promise<void> {
    if (submitterId === member.id) {
      throw new ForbiddenException('You cannot approve your own attendance exception');
    }
    await this.managerAccessService.assertAdminOrManagerOf(member, submitterId, tenantId);
  }

  async buildFiltersForExceptions(
    member: MemberContext,
    tenantId: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
  ) {
    const filters: {
      tenantMemberIds?: string[];
      startDate?: Date;
      endDate?: Date;
      status?: AttendanceExceptionStatus;
    } = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (status) filters.status = status as AttendanceExceptionStatus;

    if (employeeId) {
      await this.assertCanViewEmployee(member, tenantId, employeeId);
      filters.tenantMemberIds = [employeeId];
    } else if (!isTenantAdmin(member)) {
      const directReports = await this.managerAccessService.getDirectReportIds(tenantId, member.id);
      if (directReports.length === 0) {
        filters.tenantMemberIds = [member.id];
      } else {
        filters.tenantMemberIds = [member.id, ...directReports];
      }
    }

    return filters;
  }

  async buildFiltersForRecords(
    member: MemberContext,
    tenantId: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
  ) {
    if (employeeId) {
      await this.assertCanViewEmployee(member, tenantId, employeeId);
    } else if (!isTenantAdmin(member)) {
      throw new ForbiddenException('Admin or manager access required');
    }
    return {
      tenantMemberId: employeeId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    };
  }

  async getMonthlyAttendanceForAllMembers(
    tenantId: string,
    month?: string,
    year?: string,
    page?: string,
    limit?: string,
    member?: MemberContext,
  ) {
    const currentDate = new Date();
    const targetMonth = month
      ? DateValidationUtil.validateMonth(month)
      : currentDate.getMonth() + 1;
    const targetYear = year ? DateValidationUtil.validateYear(year) : currentDate.getFullYear();
    if (month && year) {
      DateValidationUtil.validateMonthYear(targetMonth, targetYear);
    }
    let memberIds: string[] | undefined;
    if (!isTenantAdmin(member!)) {
      memberIds = await this.managerAccessService.getDirectReportIds(tenantId, member!.id);
    }
    return this.attendanceService.getMonthlyAttendanceForAllMembers(
      tenantId,
      targetMonth,
      targetYear,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      memberIds,
    );
  }

  getMonthlyAttendanceReport(tenantId: string, month?: string, year?: string) {
    const currentDate = new Date();
    const monthNum = month ? DateValidationUtil.validateMonth(month) : currentDate.getMonth() + 1;
    const yearNum = year ? DateValidationUtil.validateYear(year) : currentDate.getFullYear();
    return this.attendanceService.getMonthlyAttendanceReport(tenantId, monthNum, yearNum);
  }

  createPolicy(tenantId: string, dto: CreateAttendancePolicyDto) {
    return this.attendanceService.createAttendancePolicy(tenantId, dto);
  }

  getPolicies(tenantId: string) {
    return this.attendanceService.getAttendancePolicies(tenantId);
  }

  getPolicy(tenantId: string, policyId: string) {
    return this.attendanceService.getAttendancePolicy(tenantId, policyId);
  }

  updatePolicy(tenantId: string, policyId: string, dto: UpdateAttendancePolicyDto) {
    return this.attendanceService.updateAttendancePolicy(tenantId, policyId, dto);
  }

  deletePolicy(tenantId: string, policyId: string) {
    return this.attendanceService.deleteAttendancePolicy(tenantId, policyId);
  }

  async getAttendanceRecords(
    tenantId: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
    view?: string,
    month?: string,
    year?: string,
    page?: string,
    limit?: string,
    member?: MemberContext,
  ) {
    if (view === 'monthly') {
      return this.getMonthlyAttendanceForAllMembers(tenantId, month, year, page, limit, member);
    }
    const filters = await this.buildFiltersForRecords(
      member!,
      tenantId,
      employeeId,
      startDate,
      endDate,
      status,
    );
    return this.attendanceService.getAttendanceRecords(tenantId, {
      memberId: filters.tenantMemberId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.status as AttendanceStatus | undefined,
    });
  }

  async getAttendanceExceptionWithAuth(
    tenantId: string,
    exceptionId: string,
    member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.assertCanViewEmployee(member, tenantId, exception.tenantMemberId);
    return exception;
  }

  async approveException(
    tenantId: string,
    exceptionId: string,
    dto: ApproveAttendanceExceptionDto,
    member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.assertCanApproveException(member, tenantId, exception.tenantMemberId);
    return this.attendanceService.approveAttendanceException(tenantId, exceptionId, member.id, dto);
  }

  async rejectException(
    tenantId: string,
    exceptionId: string,
    dto: RejectAttendanceExceptionDto,
    member: MemberContext,
  ) {
    const exception = await this.attendanceService.getAttendanceException(tenantId, exceptionId);
    await this.assertCanApproveException(member, tenantId, exception.tenantMemberId);
    return this.attendanceService.rejectAttendanceException(tenantId, exceptionId, dto, member.id);
  }

  bulkCreateAttendance(
    tenantId: string,
    records: Array<{ memberId: string; date: string; status: string; notes?: string }>,
  ) {
    return this.attendanceService.bulkCreateAttendance(tenantId, records);
  }

  createManualAttendance(
    tenantId: string,
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
}

export function getDeviceType(userAgent: string): string {
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
