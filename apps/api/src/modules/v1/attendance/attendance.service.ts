import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceExceptionStatus, type AttendanceStatus } from 'src/common/enums';
import { Between, type FindOptionsWhere } from 'typeorm';
import type { ApproveAttendanceExceptionDto } from './dto/approve-attendance-exception.dto';
import type { ClockInDto } from './dto/clock-in.dto';
import type { ClockOutDto } from './dto/clock-out.dto';
import type { CreateAttendanceExceptionDto } from './dto/create-attendance-exception.dto';
import type { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import type { RejectAttendanceExceptionDto } from './dto/reject-attendance-exception.dto';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto';
import type { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import { Attendance } from './entities/attendance.entity';
import { AttendanceRepository } from './repositories/attendance.repository';
import { AttendanceClockService } from './services/attendance-clock.service';
import { AttendanceExceptionService } from './services/attendance-exception.service';
import { AttendancePolicyService } from './services/attendance-policy.service';
import { AttendanceReportService } from './services/attendance-report.service';
import { AttendanceSessionService } from './services/attendance-session.service';
import { DepartmentUtils } from './utils/department.utils';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly policyService: AttendancePolicyService,
    private readonly clockService: AttendanceClockService,
    private readonly sessionService: AttendanceSessionService,
    private readonly exceptionService: AttendanceExceptionService,
    private readonly reportService: AttendanceReportService,
    private readonly departmentUtils: DepartmentUtils,
  ) {}

  async createAttendancePolicy(
    tenantId: string,
    dto: CreateAttendancePolicyDto,
    actorMemberId?: string,
  ) {
    return this.policyService.create(tenantId, dto, actorMemberId);
  }
  async getAttendancePolicies(tenantId: string) {
    return this.policyService.findAll(tenantId);
  }
  async getAttendancePolicy(tenantId: string, policyId: string) {
    return this.policyService.findOne(tenantId, policyId);
  }
  async updateAttendancePolicy(
    tenantId: string,
    policyId: string,
    dto: UpdateAttendancePolicyDto,
    actorMemberId?: string,
  ) {
    return this.policyService.update(tenantId, policyId, dto, actorMemberId);
  }
  async deleteAttendancePolicy(tenantId: string, policyId: string, actorMemberId?: string) {
    return this.policyService.remove(tenantId, policyId, actorMemberId);
  }

  async clockIn(
    tenantId: string,
    tenantMemberId: string,
    dto: ClockInDto,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceType?: string;
      entryMethod?: string;
    },
  ) {
    return this.clockService.clockIn(tenantId, tenantMemberId, dto, metadata);
  }
  async clockOut(tenantId: string, tenantMemberId: string, attendanceId: string, dto: ClockOutDto) {
    return this.clockService.clockOut(tenantId, tenantMemberId, attendanceId, dto);
  }
  async getTodayAttendance(tenantId: string, tenantMemberId: string) {
    return this.sessionService.getTodayAttendance(tenantId, tenantMemberId);
  }
  async getClockInInfo(tenantId: string, tenantMemberId: string, targetDate?: Date) {
    return this.sessionService.getClockInInfo(tenantId, tenantMemberId, targetDate);
  }
  async getSessionLimit(tenantId: string) {
    return this.sessionService.getSessionLimit(tenantId);
  }
  async getCurrentSessionCount(tenantId: string, tenantMemberId: string, date?: Date) {
    return this.sessionService.getCurrentSessionCount(tenantId, tenantMemberId, date);
  }
  async createManualAttendance(
    tenantId: string,
    tenantMemberId: string,
    dto: {
      date: Date;
      clockIn?: Date;
      clockOut?: Date;
      status: string;
      location?: string;
      notes?: string;
    },
  ) {
    return this.sessionService.createManualAttendance(tenantId, tenantMemberId, dto);
  }

  async createAttendanceException(
    tenantId: string,
    tenantMemberId: string,
    dto: CreateAttendanceExceptionDto,
  ) {
    return this.exceptionService.create(tenantId, tenantMemberId, dto);
  }
  async getAttendanceExceptions(
    tenantId: string,
    filters?: {
      tenantMemberIds?: string[];
      status?: AttendanceExceptionStatus;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.exceptionService.findAll(tenantId, filters);
  }
  async getAttendanceException(tenantId: string, exceptionId: string) {
    return this.exceptionService.findOne(tenantId, exceptionId);
  }
  async approveAttendanceException(
    tenantId: string,
    exceptionId: string,
    approvedById: string,
    dto: ApproveAttendanceExceptionDto,
  ) {
    return this.exceptionService.approve(tenantId, exceptionId, approvedById, dto);
  }
  async rejectAttendanceException(
    tenantId: string,
    exceptionId: string,
    dto: RejectAttendanceExceptionDto,
    approvedById: string,
  ) {
    return this.exceptionService.reject(tenantId, exceptionId, dto, approvedById);
  }

  async getDailyAttendanceReport(tenantId: string, date: Date) {
    return this.reportService.getDailyReport(tenantId, date);
  }
  async getMonthlyAttendanceReport(tenantId: string, month: number, year: number) {
    return this.reportService.getMonthlyReport(tenantId, month, year);
  }
  async getEmployeeAttendanceReport(
    tenantId: string,
    memberId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.reportService.getEmployeeReport(tenantId, memberId, startDate, endDate);
  }
  async getAttendanceStats(tenantId: string, startDate: Date, endDate: Date) {
    return this.reportService.getStats(tenantId, startDate, endDate);
  }
  async getMonthlyAttendanceForAllMembers(
    tenantId: string,
    month: number,
    year: number,
    page?: number,
    limit?: number,
    memberIds?: string[],
  ) {
    return this.reportService.getMonthlyForAllMembers(
      tenantId,
      month,
      year,
      page,
      limit,
      memberIds,
    );
  }

  async getAttendanceRecords(
    tenantId: string,
    filters?: { memberId?: string; startDate?: Date; endDate?: Date; status?: AttendanceStatus },
  ) {
    const where: FindOptionsWhere<Attendance> = { tenantId };
    if (filters?.memberId) where.tenantMemberId = filters.memberId;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.date = Between(start, end);
    }
    return this.attendanceRepo.find({
      where,
      relations: ['tenantMember', 'tenantMember.user'],
      order: { date: 'DESC', sessionNumber: 'ASC' },
    });
  }

  async getAttendance(tenantId: string, attendanceId: string) {
    const attendance = await this.attendanceRepo.findOne({
      where: { id: attendanceId, tenantId },
      relations: ['tenantMember', 'tenantMember.user'],
    });
    if (!attendance) throw new NotFoundException('Attendance record not found');
    const m = attendance.tenantMember;
    const department = m ? await this.departmentUtils.getMemberDepartment(tenantId, m.id) : null;
    return {
      ...attendance,
      member: m
        ? {
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.user?.email || null,
            department: this.departmentUtils.formatDepartmentResponse(department),
            avatar: m.avatarKey,
            role: m.role,
            employeeNumber: m.employeeNumber,
            status: m.isActive ? 'ACTIVE' : 'INACTIVE',
          }
        : null,
    };
  }

  async updateAttendance(tenantId: string, attendanceId: string, dto: UpdateAttendanceDto) {
    const attendance = await this.getAttendance(tenantId, attendanceId);
    Object.assign(attendance, dto);
    return this.attendanceRepo.save(attendance);
  }

  async deleteAttendance(tenantId: string, attendanceId: string) {
    const attendance = await this.getAttendance(tenantId, attendanceId);
    if (!attendance) throw new NotFoundException('Attendance record not found');
    return this.attendanceRepo.delete(attendanceId);
  }

  async bulkCreateAttendance(
    tenantId: string,
    records: Array<{ memberId: string; date: string; status: string; notes?: string }>,
  ) {
    return this.attendanceRepo.insert(
      records.map((r) => ({
        tenantId,
        tenantMemberId: r.memberId,
        date: new Date(r.date),
        status: r.status as AttendanceStatus,
        notes: r.notes,
        clockIn: r.status === 'PRESENT' ? new Date() : undefined,
      })),
    );
  }
}
