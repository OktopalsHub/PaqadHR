import { Injectable, Logger } from '@nestjs/common';
import { AttendancePolicyService } from './services/attendance-policy.service';
import { AttendanceClockService } from './services/attendance-clock.service';
import { AttendanceRecordService } from './services/attendance-record.service';
import { AttendanceExceptionService } from './services/attendance-exception.service';
import { AttendanceReportService } from './services/attendance-report.service';
import { AttendanceBulkService } from './services/attendance-bulk.service';
import type { AttendancePolicy } from './entities/attendance-policy.entity';
import type { Attendance } from './entities/attendance.entity';
import type { AttendanceException } from './entities/attendance-exception.entity';
import type { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import type { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import type { ClockInDto } from './dto/clock-in.dto';
import type { ClockOutDto } from './dto/clock-out.dto';
import type { GetAttendanceRecordsDto } from './dto/get-attendance-records.dto';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto';
import type { CreateAttendanceExceptionDto } from './dto/create-attendance-exception.dto';

/**
 * Facade service that delegates to specialized attendance services.
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly policyService: AttendancePolicyService,
    private readonly clockService: AttendanceClockService,
    private readonly recordService: AttendanceRecordService,
    private readonly exceptionService: AttendanceExceptionService,
    private readonly reportService: AttendanceReportService,
    private readonly bulkService: AttendanceBulkService,
  ) { }

  // ==================== Policy Operations ====================

  async createAttendancePolicy(
    dto: CreateAttendancePolicyDto,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<AttendancePolicy> {
    return this.policyService.createAttendancePolicy(dto, tenantId, actorMemberId);
  }

  async getAttendancePolicies(tenantId: string): Promise<AttendancePolicy[]> {
    return this.policyService.getAttendancePolicies(tenantId);
  }

  async getAttendancePolicy(tenantId: string, policyId: string): Promise<AttendancePolicy> {
    return this.policyService.getAttendancePolicy(tenantId, policyId);
  }

  async updateAttendancePolicy(
    tenantId: string,
    policyId: string,
    dto: UpdateAttendancePolicyDto,
    actorMemberId?: string,
  ): Promise<AttendancePolicy> {
    return this.policyService.updateAttendancePolicy(tenantId, policyId, dto, actorMemberId);
  }

  async deleteAttendancePolicy(
    tenantId: string,
    policyId: string,
    actorMemberId?: string,
  ): Promise<void> {
    return this.policyService.deleteAttendancePolicy(tenantId, policyId, actorMemberId);
  }

  // ==================== Clock Operations ====================

  async clockIn(
    tenantId: string,
    tenantMemberId: string,
    dto: ClockInDto,
  ): Promise<Attendance> {
    return this.clockService.clockIn(tenantId, tenantMemberId, dto);
  }

  async clockOut(
    tenantId: string,
    tenantMemberId: string,
    attendanceId: string,
    dto: ClockOutDto,
  ): Promise<Attendance> {
    return this.clockService.clockOut(tenantId, tenantMemberId, attendanceId, dto);
  }

  async getTodayAttendance(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Attendance | null> {
    return this.clockService.getTodayAttendance(tenantId, tenantMemberId);
  }

  async getClockInInfo(
    tenantId: string,
    tenantMemberId: string,
    date: Date = new Date(),
  ): Promise<{ canClockIn: boolean; message?: string; currentSession?: Attendance }> {
    return this.clockService.getClockInInfo(tenantId, tenantMemberId, date);
  }

  // ==================== Record Operations ====================

  async getAttendanceRecords(
    tenantId: string,
    dto: GetAttendanceRecordsDto,
  ): Promise<{ records: Attendance[]; total: number }> {
    return this.recordService.getAttendanceRecords(tenantId, dto);
  }

  async getAttendance(tenantId: string, attendanceId: string): Promise<Attendance> {
    return this.recordService.getAttendance(tenantId, attendanceId);
  }

  async updateAttendance(
    tenantId: string,
    attendanceId: string,
    dto: UpdateAttendanceDto,
  ): Promise<Attendance> {
    return this.recordService.updateAttendance(tenantId, attendanceId, dto);
  }

  async deleteAttendance(tenantId: string, attendanceId: string): Promise<void> {
    return this.recordService.deleteAttendance(tenantId, attendanceId);
  }

  // ==================== Exception Operations ====================

  async createAttendanceException(
    tenantId: string,
    dto: CreateAttendanceExceptionDto,
  ): Promise<AttendanceException> {
    return this.exceptionService.createAttendanceException(tenantId, dto);
  }

  async getAttendanceExceptions(
    tenantId: string,
    options?: { memberId?: string; status?: string },
  ): Promise<AttendanceException[]> {
    return this.exceptionService.getAttendanceExceptions(tenantId, options);
  }

  async getAttendanceException(tenantId: string, exceptionId: string): Promise<AttendanceException> {
    return this.exceptionService.getAttendanceException(tenantId, exceptionId);
  }

  async approveAttendanceException(
    tenantId: string,
    exceptionId: string,
    approverId: string,
  ): Promise<AttendanceException> {
    return this.exceptionService.approveAttendanceException(tenantId, exceptionId, approverId);
  }

  async rejectAttendanceException(
    tenantId: string,
    exceptionId: string,
    rejectorId: string,
    reason?: string,
  ): Promise<AttendanceException> {
    return this.exceptionService.rejectAttendanceException(tenantId, exceptionId, rejectorId, reason);
  }

  // ==================== Report Operations ====================

  async getDailyAttendanceReport(tenantId: string, date: Date): Promise<any> {
    return this.reportService.getDailyAttendanceReport(tenantId, date);
  }

  async getMonthlyAttendanceReport(
    tenantId: string,
    month: number,
    year: number,
  ): Promise<any> {
    return this.reportService.getMonthlyAttendanceReport(tenantId, month, year);
  }

  async getEmployeeAttendanceReport(
    tenantId: string,
    memberId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return this.reportService.getEmployeeAttendanceReport(tenantId, memberId, startDate, endDate);
  }

  async getAttendanceStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return this.reportService.getAttendanceStats(tenantId, startDate, endDate);
  }

  async getMonthlyAttendanceForAllMembers(
    tenantId: string,
    month: number,
    year: number,
  ): Promise<any> {
    return this.reportService.getMonthlyAttendanceForAllMembers(tenantId, month, year);
  }

  // ==================== Bulk Operations ====================

  async bulkCreateAttendance(
    tenantId: string,
    records: Array<{
      memberId: string;
      clockInAt: Date;
      clockOutAt: Date;
      status: string;
    }>,
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    return this.bulkService.bulkCreateAttendance(tenantId, records);
  }

  async createManualAttendance(
    tenantId: string,
    data: {
      memberId: string;
      date: Date;
      clockInAt: Date;
      clockOutAt: Date;
      status: string;
      remarks?: string;
    },
  ): Promise<Attendance> {
    return this.bulkService.createManualAttendance(tenantId, data);
  }

  // ==================== Utility Methods ====================

  async getSessionLimit(tenantId: string): Promise<number> {
    return this.policyService.getSessionLimit(tenantId);
  }

  async getCurrentSessionCount(
    tenantId: string,
    memberId?: string,
  ): Promise<{ total: number; active: number }> {
    return this.recordService.getCurrentSessionCount(tenantId, memberId);
  }
}
