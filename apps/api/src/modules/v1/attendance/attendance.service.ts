import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type AttendanceStatus, EAttendanceExceptionStatus } from 'src/common/enums';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import { Between, type FindOptionsWhere } from 'typeorm';
import type { LeaveResponseDto } from '../leave/dto/leave-response.dto';
import { LeaveService } from '../leave/leave.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../tenant-settings/services/tenant-settings.service';
import type { ApproveAttendanceExceptionDto } from './dto/approve-attendance-exception.dto';
import type { ClockInDto } from './dto/clock-in.dto';
import type { ClockOutDto } from './dto/clock-out.dto';
import type { CreateAttendanceExceptionDto } from './dto/create-attendance-exception.dto';
import type { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import type { RejectAttendanceExceptionDto } from './dto/reject-attendance-exception.dto';
import type { UpdateAttendanceDto } from './dto/update-attendance.dto';
import type { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import type { Attendance } from './entities/attendance.entity';
import type { AttendanceException } from './entities/attendance-exception.entity';
import { AttendanceRepository } from './repositories/attendance.repository';
import { AttendanceExceptionRepository } from './repositories/attendance-exception.repository';
import { AttendancePolicyRepository } from './repositories/attendance-policy.repository';
import type { DepartmentUtils } from './utils/department.utils';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly attendanceExceptionRepository: AttendanceExceptionRepository,
    private readonly attendancePolicyRepository: AttendancePolicyRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly leaveService: LeaveService,
    private readonly departmentUtils: DepartmentUtils,
  ) {}
  async createAttendancePolicy(tenantId: string, dto: CreateAttendancePolicyDto) {
    return this.attendancePolicyRepository.create({ ...dto, tenantId });
  }
  async getAttendancePolicies(tenantId: string) {
    return this.attendancePolicyRepository.find({ where: { tenantId } });
  }
  async getAttendancePolicy(tenantId: string, policyId: string) {
    const policy = await this.attendancePolicyRepository.findOne({
      where: { id: policyId, tenantId },
    });
    if (!policy) {
      throw new NotFoundException('Attendance policy not found');
    }
    return policy;
  }
  async updateAttendancePolicy(tenantId: string, policyId: string, dto: UpdateAttendancePolicyDto) {
    await this.getAttendancePolicy(tenantId, policyId);
    await this.attendancePolicyRepository.update(policyId, dto);
    return this.attendancePolicyRepository.findOne({
      where: { id: policyId, tenantId },
    });
  }
  async deleteAttendancePolicy(tenantId: string, policyId: string) {
    await this.getAttendancePolicy(tenantId, policyId);
    return this.attendancePolicyRepository.delete(policyId);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isWeekendDay = await this.isWeekend(tenantId, today);
    if (isWeekendDay) {
      throw new ConflictException('Cannot clock in on weekends.');
    }
    const leaveStatus = await this.isOnLeave(tenantId, tenantMemberId, today);
    if (leaveStatus.isOnLeave) {
      throw new ConflictException(
        `Cannot clock in while on leave${leaveStatus.leaveType ? `: ${leaveStatus.leaveType}` : ''}.`,
      );
    }
    const activeSession = await this.attendanceRepository.findOne({
      where: {
        tenantId,
        tenantMemberId,
        date: today,
        sessionStatus: 'ACTIVE',
      },
    });
    if (activeSession) {
      throw new ConflictException('You already have an active session. Please clock out first.');
    }
    const policy = await this.attendancePolicyRepository.findOne({
      where: { tenantId, isActive: true },
    });
    const maxSessionsPerDay = policy?.maxSessionsPerDay || 3;
    const todaySessions = await this.attendanceRepository.find({
      where: {
        tenantId,
        tenantMemberId,
        date: today,
      },
      order: { sessionNumber: 'DESC' },
    });
    const nextSessionNumber =
      todaySessions.length > 0 ? Math.max(...todaySessions.map((s) => s.sessionNumber)) + 1 : 1;
    if (nextSessionNumber > maxSessionsPerDay) {
      throw new ConflictException(
        `Maximum sessions per day (${maxSessionsPerDay}) reached. Please contact your administrator.`,
      );
    }
    const attendance = await this.attendanceRepository.create({
      tenantId,
      tenantMemberId,
      date: new Date(),
      clockIn: new Date(),
      status: 'PRESENT',
      sessionStatus: 'ACTIVE',
      sessionNumber: nextSessionNumber,
      location: dto.location || 'Office',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      deviceType: metadata?.deviceType,
      entryMethod: 'auto',
      isManualEntry: false,
    });
    return attendance;
  }
  private formatTimeToHHMMSS(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  async clockOut(tenantId: string, tenantMemberId: string, attendanceId: string, dto: ClockOutDto) {
    const attendance = await this.attendanceRepository.findOne({
      where: {
        id: attendanceId,
        tenantId,
        tenantMemberId,
        sessionStatus: 'ACTIVE',
      },
    });
    if (!attendance) {
      throw new NotFoundException('Active attendance session not found.');
    }
    if (!attendance.clockIn) {
      throw new ConflictException('Cannot clock out without clock in time.');
    }
    const clockOutTime = new Date();
    let clockInTime: Date;
    try {
      clockInTime = new Date(attendance.clockIn);
      if (Number.isNaN(clockInTime.getTime())) {
        throw new BadRequestException('Invalid clock in time');
      }
    } catch (_error) {
      throw new ConflictException('Invalid clock in time format.');
    }
    const workTimeMs = clockOutTime.getTime() - clockInTime.getTime();
    const workHours = this.formatTimeToHHMMSS(workTimeMs);
    await this.attendanceRepository.update(attendanceId, {
      clockOut: clockOutTime,
      sessionStatus: 'CLOSED',
      workHours: workHours,
      location: dto.location || attendance.location,
      notes: dto.notes,
      entryMethod: 'auto',
    });
    return this.attendanceRepository.findOne({
      where: { id: attendanceId, tenantId },
    });
  }
  async getAttendanceRecords(
    tenantId: string,
    filters: {
      tenantMemberId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    } = {},
  ) {
    const where: FindOptionsWhere<Attendance> = { tenantId };
    if (filters.tenantMemberId) {
      where.tenantMemberId = filters.tenantMemberId;
    }
    if (filters.startDate && filters.endDate) {
      where.date = Between(filters.startDate, filters.endDate);
    } else if (filters.startDate) {
      where.date = Between(filters.startDate, new Date());
    }
    if (filters.status) {
      where.status = filters.status as Attendance['status'];
    }
    const attendances = await this.attendanceRepository.find({
      where,
      relations: ['tenantMember', 'tenantMember.user'],
    });
    const transformedAttendances = attendances.map((attendance) => {
      const member = attendance.tenantMember;
      return {
        ...attendance,
        member: member
          ? {
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              email: member.user?.email || null,
              department: null,
              avatar: member.avatarKey,
              role: member.role,
              employeeNumber: member.employeeNumber,
              status: member.isActive ? 'ACTIVE' : 'INACTIVE',
            }
          : null,
      };
    });
    return transformedAttendances;
  }
  async getAttendance(tenantId: string, attendanceId: string) {
    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId, tenantId },
      relations: ['tenantMember', 'tenantMember.user'],
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }
    const member = attendance.tenantMember;
    const department = member
      ? await this.departmentUtils.getMemberDepartment(tenantId, member.id)
      : null;
    return {
      ...attendance,
      member: member
        ? {
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.user?.email || null,
            department: this.departmentUtils.formatDepartmentResponse(department),
            avatar: member.avatarKey,
            role: member.role,
            employeeNumber: member.employeeNumber,
            status: member.isActive ? 'ACTIVE' : 'INACTIVE',
          }
        : null,
    };
  }
  async updateAttendance(tenantId: string, attendanceId: string, dto: UpdateAttendanceDto) {
    await this.getAttendance(tenantId, attendanceId);
    await this.attendanceRepository.update(attendanceId, dto);
    return this.attendanceRepository.findOne({
      where: { id: attendanceId, tenantId },
    });
  }
  async createAttendanceException(
    tenantId: string,
    tenantMemberId: string,
    dto: CreateAttendanceExceptionDto,
  ) {
    return this.attendanceExceptionRepository.create({
      ...dto,
      tenantId,
      tenantMemberId,
    });
  }
  async getAttendanceExceptions(
    tenantId: string,
    filters: {
      tenantMemberId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    } = {},
  ) {
    const where: FindOptionsWhere<AttendanceException> = { tenantId };
    if (filters.tenantMemberId) {
      where.tenantMemberId = filters.tenantMemberId;
    }
    if (filters.startDate && filters.endDate) {
      where.date = Between(filters.startDate, filters.endDate);
    } else if (filters.startDate) {
      where.date = Between(filters.startDate, new Date());
    }
    if (filters.status) {
      where.status = filters.status as AttendanceException['status'];
    }
    return this.attendanceExceptionRepository.find({
      where,
      relations: ['tenantMember', 'approvedBy'],
    });
  }
  async getAttendanceException(tenantId: string, exceptionId: string) {
    const exception = await this.attendanceExceptionRepository.findOne({
      where: { id: exceptionId, tenantId },
      relations: ['tenantMember', 'approvedBy'],
    });
    if (!exception) {
      throw new NotFoundException('Attendance exception not found');
    }
    return exception;
  }
  async approveAttendanceException(
    tenantId: string,
    exceptionId: string,
    approvedById: string,
    dto: ApproveAttendanceExceptionDto,
  ) {
    const exception = await this.getAttendanceException(tenantId, exceptionId);
    if (exception.status !== EAttendanceExceptionStatus.PENDING) {
      throw new ConflictException('Exception is not pending approval');
    }
    await this.attendanceExceptionRepository.update(exceptionId, {
      status: EAttendanceExceptionStatus.APPROVED,
      approvedById,
      approvedAt: new Date(),
    });
    return this.attendanceExceptionRepository.findOne({
      where: { id: exceptionId, tenantId },
    });
  }
  async rejectAttendanceException(
    tenantId: string,
    exceptionId: string,
    dto: RejectAttendanceExceptionDto,
  ) {
    const exception = await this.getAttendanceException(tenantId, exceptionId);
    if (exception.status !== EAttendanceExceptionStatus.PENDING) {
      throw new ConflictException('Exception is not pending approval');
    }
    await this.attendanceExceptionRepository.update(exceptionId, {
      status: EAttendanceExceptionStatus.REJECTED,
    });
    return this.attendanceExceptionRepository.findOne({
      where: { id: exceptionId, tenantId },
    });
  }
  async getDailyAttendanceReport(tenantId: string, date: Date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const attendances = await this.attendanceRepository.find({
        where: {
          tenantId,
          date: Between(startOfDay, endOfDay),
        },
        relations: ['tenantMember', 'tenantMember.user'],
      });
      const transformedAttendances = await Promise.all(
        attendances.map(async (attendance) => {
          const member = attendance.tenantMember;
          const department = member
            ? await this.departmentUtils.getMemberDepartment(tenantId, member.id)
            : null;
          return {
            ...attendance,
            member: member
              ? {
                  id: member.id,
                  firstName: member.firstName,
                  lastName: member.lastName,
                  email: member.user?.email || null,
                  department: this.departmentUtils.formatDepartmentResponse(department),
                  avatar: member.avatarKey,
                  role: member.role,
                  employeeNumber: member.employeeNumber,
                  status: member.isActive ? 'ACTIVE' : 'INACTIVE',
                }
              : null,
          };
        }),
      );
      const totalEmployees = await this.tenantMembersService.getTenantMembersCount(tenantId);
      const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
      const absentCount = attendances.filter((a) => a.status === 'ABSENT').length;
      const lateCount = attendances.filter((a) => a.status === 'LATE').length;
      const onLeaveCount = attendances.filter((a) => a.status === 'ON_LEAVE').length;
      return {
        date: date.toISOString().split('T')[0],
        totalEmployees,
        presentCount,
        absentCount,
        lateCount,
        onLeaveCount,
        attendanceRate: totalEmployees > 0 ? (presentCount / totalEmployees) * 100 : 0,
        attendances: transformedAttendances,
      };
    } catch (error) {
      this.logger.error('getDailyAttendanceReport failed', error);
      throw error;
    }
  }
  async getMonthlyAttendanceReport(tenantId: string, month: number, year: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const attendances = await this.attendanceRepository.find({
      where: {
        tenantId,
        date: Between(startOfMonth, endOfMonth),
      },
      relations: ['tenantMember'],
    });
    const totalEmployees = await this.tenantMembersService.getTenantMembersCount(tenantId);
    const workingDays = await this.getWorkingDaysInMonth(tenantId, year, month);
    const totalExpectedAttendance = totalEmployees * workingDays;
    const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendances.filter((a) => a.status === 'ABSENT').length;
    const lateCount = attendances.filter((a) => a.status === 'LATE').length;
    const onLeaveCount = attendances.filter((a) => a.status === 'ON_LEAVE').length;
    return {
      month,
      year,
      totalEmployees,
      workingDays,
      totalExpectedAttendance,
      presentCount,
      absentCount,
      lateCount,
      onLeaveCount,
      attendanceRate:
        totalExpectedAttendance > 0 ? (presentCount / totalExpectedAttendance) * 100 : 0,
      attendances,
    };
  }
  async getEmployeeAttendanceReport(
    tenantId: string,
    memberId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const attendances = await this.attendanceRepository.find({
      where: {
        tenantId,
        tenantMemberId: memberId,
        date: Between(startDate, endDate),
      },
      relations: ['tenantMember'],
    });
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendances.filter((a) => a.status === 'ABSENT').length;
    const lateCount = attendances.filter((a) => a.status === 'LATE').length;
    const onLeaveCount = attendances.filter((a) => a.status === 'ON_LEAVE').length;
    return {
      memberId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays,
      presentCount,
      absentCount,
      lateCount,
      onLeaveCount,
      attendanceRate: totalDays > 0 ? (presentCount / totalDays) * 100 : 0,
      attendances,
    };
  }
  private async getWorkingDaysInMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    const tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const weekends = tenantSettings?.settings?.attendance?.weekends || [0, 6];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (!weekends.includes(dayOfWeek)) {
        workingDays++;
      }
    }
    return workingDays;
  }
  async getTodayAttendance(tenantId: string, tenantMemberId: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendances = await this.attendanceRepository.find({
        where: {
          tenantId,
          tenantMemberId,
          date: today,
        },
        order: { sessionNumber: 'ASC' },
      });
      if (attendances.length === 0) {
        return null;
      }
      const activeSession = attendances.find((a) => a.sessionStatus === 'ACTIVE');
      if (activeSession) {
        return activeSession;
      }
      return attendances[attendances.length - 1];
    } catch (error) {
      this.logger.error('getTodayAttendance failed', error);
      throw error;
    }
  }
  async getAttendanceStats(tenantId: string, startDate: Date, endDate: Date) {
    const attendances = await this.attendanceRepository.find({
      where: {
        tenantId,
        date: Between(startDate, endDate),
      },
      relations: ['tenantMember'],
    });
    const totalPresent = attendances.filter((a) => a.status === 'PRESENT').length;
    const totalAbsent = attendances.filter((a) => a.status === 'ABSENT').length;
    const totalLate = attendances.filter((a) => a.status === 'LATE').length;
    const totalHalfDay = attendances.filter((a) => a.status === 'HALF_DAY').length;
    const totalOnLeave = attendances.filter((a) => a.status === 'ON_LEAVE').length;
    const stats = {
      totalPresent,
      totalAbsent,
      totalLate,
      totalHalfDay,
      totalOnLeave,
      totalRecords: attendances.length,
    };
    return stats;
  }
  async bulkCreateAttendance(
    tenantId: string,
    records: Array<{
      memberId: string;
      date: string;
      status: string;
      notes?: string;
    }>,
  ) {
    const attendanceRecords = records.map((record) => ({
      tenantId,
      tenantMemberId: record.memberId,
      date: new Date(record.date),
      status: record.status as AttendanceStatus,
      notes: record.notes,
      clockIn: record.status === 'PRESENT' ? new Date() : undefined,
    }));
    return this.attendanceRepository.insert(attendanceRecords);
  }
  async deleteAttendance(tenantId: string, attendanceId: string) {
    const attendance = await this.getAttendance(tenantId, attendanceId);
    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }
    return this.attendanceRepository.delete(attendanceId);
  }
  async getSessionLimit(tenantId: string): Promise<number> {
    const policy = await this.attendancePolicyRepository.findOne({
      where: { tenantId, isActive: true },
    });
    return policy?.maxSessionsPerDay || 3;
  }
  async getCurrentSessionCount(
    tenantId: string,
    tenantMemberId: string,
    date: Date = new Date(),
  ): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const todaySessions = await this.attendanceRepository.find({
      where: {
        tenantId,
        tenantMemberId,
        date: startOfDay,
      },
    });
    return todaySessions.length;
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
    let workHours: string | undefined;
    if (dto.clockIn && dto.clockOut) {
      const workTimeMs = dto.clockOut.getTime() - dto.clockIn.getTime();
      workHours = this.formatTimeToHHMMSS(workTimeMs);
    }
    const attendance = await this.attendanceRepository.create({
      tenantId,
      tenantMemberId,
      date: dto.date,
      clockIn: dto.clockIn,
      clockOut: dto.clockOut,
      status: dto.status,
      sessionStatus: dto.clockOut ? 'CLOSED' : 'ACTIVE',
      sessionNumber: 1,
      workHours: workHours,
      location: dto.location || 'Office',
      notes: dto.notes,
      entryMethod: 'manual',
      isManualEntry: true,
    });
    return attendance;
  }
  private async isWeekend(tenantId: string, date: Date): Promise<boolean> {
    try {
      const tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const weekends = tenantSettings.settings.attendance?.weekends || [0, 6];
      const dayOfWeek = date.getDay();
      return weekends.includes(dayOfWeek);
    } catch (_error) {
      const dayOfWeek = date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    }
  }
  private async isOnLeave(
    tenantId: string,
    tenantMemberId: string,
    date: Date,
  ): Promise<{ isOnLeave: boolean; leaveType?: string }> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const leaves = await this.leaveService.getLeavesByMember(tenantId, tenantMemberId, {
        page: 1,
        limit: 100,
      });
      for (const leave of leaves.records) {
        if (leave.status === 'APPROVED') {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          if (date >= leaveStart && date <= leaveEnd) {
            return {
              isOnLeave: true,
              leaveType: leave.leaveType?.name,
            };
          }
        }
      }
      return { isOnLeave: false };
    } catch (_error) {
      return { isOnLeave: false };
    }
  }
  async getMonthlyAttendanceForAllMembers(
    tenantId: string,
    month: number,
    year: number,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      const allMembers = await this.tenantMembersService.getTenantMembers(tenantId);
      const activeMembers = allMembers.filter((member) => member.isActive);
      const paginatedMembers = activeMembers.slice(skip, skip + limit);
      const members = await getPaginationSummary(
        paginatedMembers,
        activeMembers.length,
        { page, limit },
        'members',
      );
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      const daysInMonth = endOfMonth.getDate();
      let tenantSettings;
      try {
        tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
        if (!tenantSettings.settings.attendance) {
          tenantSettings.settings.attendance = { weekends: [0, 6] };
        }
        if (!tenantSettings.settings.attendance.weekends) {
          tenantSettings.settings.attendance.weekends = [0, 6];
        }
      } catch (_error) {
        tenantSettings = {
          settings: {
            attendance: {
              weekends: [0, 6],
            },
          },
        };
      }
      const membersAttendance: unknown[] = [];
      for (const member of members.records) {
        const attendanceRecords = await this.attendanceRepository.find({
          where: {
            tenantId,
            tenantMemberId: member.id,
            date: Between(startOfMonth, endOfMonth),
          },
        });
        let memberLeaves: LeaveResponseDto[] = [];
        try {
          const leavesResult = await this.leaveService.getLeavesByMember(tenantId, member.id, {
            page: 1,
            limit: 100,
          });
          memberLeaves = leavesResult.records.filter(
            (leave) =>
              leave.status === 'APPROVED' &&
              new Date(leave.startDate) <= endOfMonth &&
              new Date(leave.endDate) >= startOfMonth,
          );
        } catch (_error) {}
        const dailyAttendance: Array<{
          date: string;
          day: number;
          status: string;
          isWeekend: boolean;
          isOnLeave: boolean;
          leaveType?: string;
          attendance: Array<{
            id: string;
            clockIn: Date | null;
            clockOut: Date | null;
            workHours: string | null;
            sessionNumber: number;
            sessionStatus: string;
            location: string | null;
            notes: string | null;
          }>;
        }> = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month - 1, day);
          const dateString = currentDate.toISOString().split('T')[0];
          const isWeekend = tenantSettings.settings.attendance.weekends.includes(
            currentDate.getDay(),
          );
          const onLeave = memberLeaves.find((leave) => {
            const leaveStart = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);
            return currentDate >= leaveStart && currentDate <= leaveEnd;
          });
          const dayAttendance = attendanceRecords.filter((record) => {
            const recordDate = new Date(record.date);
            return recordDate.toDateString() === currentDate.toDateString();
          });
          let status = 'WORKING_DAY';
          if (isWeekend) {
            status = 'WEEKEND';
          } else if (onLeave) {
            status = 'ON_LEAVE';
          } else if (dayAttendance.length > 0) {
            status = dayAttendance[0].status || 'PRESENT';
          } else {
            status = 'ABSENT';
          }
          dailyAttendance.push({
            date: dateString,
            day,
            status,
            isWeekend,
            isOnLeave: !!onLeave,
            leaveType: onLeave?.leaveType?.name,
            attendance: dayAttendance.map((att) => ({
              id: att.id,
              clockIn: att.clockIn,
              clockOut: att.clockOut,
              workHours: att.workHours,
              sessionNumber: att.sessionNumber,
              sessionStatus: att.sessionStatus,
              location: att.location,
              notes: att.notes,
            })),
          });
        }
        const presentDays = dailyAttendance.filter(
          (d) => d.status === 'PRESENT' || d.status === 'LATE',
        ).length;
        const absentDays = dailyAttendance.filter((d) => d.status === 'ABSENT').length;
        const weekendDays = dailyAttendance.filter((d) => d.status === 'WEEKEND').length;
        const leaveDays = dailyAttendance.filter((d) => d.status === 'ON_LEAVE').length;
        const workingDays = daysInMonth - weekendDays;
        const attendanceRate = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;
        membersAttendance.push({
          member: {
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.user?.email,
            department: this.departmentUtils.formatDepartmentResponse(
              await this.departmentUtils.getMemberDepartment(tenantId, member.id),
            ),
            employeeNumber: member.employeeNumber,
            avatar: member.avatarKey,
          },
          statistics: {
            totalDays: daysInMonth,
            workingDays,
            presentDays,
            absentDays,
            weekendDays,
            leaveDays,
            attendanceRate: Math.round(attendanceRate * 100) / 100,
          },
          dailyAttendance,
        });
      }
      const totalPages = Math.ceil(members.totalItems / limit);
      return {
        month,
        year,
        pagination: {
          page,
          limit,
          total: members.totalItems,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        summary: {
          totalMembers: membersAttendance.length,
          daysInMonth,
          workingDays:
            daysInMonth -
            Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(year, month - 1, i + 1);
              return tenantSettings.settings.attendance.weekends.includes(date.getDay());
            }).filter(Boolean).length,
        },
        members: membersAttendance,
      };
    } catch (error) {
      this.logger.error('getMonthlyAttendanceForAllMembers failed', error);
      throw error;
    }
  }
  async getClockInInfo(tenantId: string, tenantMemberId: string, date: Date = new Date()) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const [isWeekendResult, leaveResult] = await Promise.all([
      this.isWeekend(tenantId, targetDate),
      this.isOnLeave(tenantId, tenantMemberId, targetDate),
    ]);
    const existingAttendance = await this.attendanceRepository.find({
      where: {
        tenantId,
        tenantMemberId,
        date: targetDate,
      },
      order: { sessionNumber: 'ASC' },
    });
    const sessionLimit = await this.getSessionLimit(tenantId);
    const currentSessionCount = existingAttendance.length;
    const activeSession = existingAttendance.find((a) => a.sessionStatus === 'ACTIVE');
    let status = 'WORKING_DAY';
    let canClockIn = true;
    let reason = '';
    if (isWeekendResult) {
      status = 'WEEKEND';
      canClockIn = false;
      reason = 'Weekend';
    } else if (leaveResult.isOnLeave) {
      status = 'ON_LEAVE';
      canClockIn = false;
      reason = `On Leave: ${leaveResult.leaveType || 'Leave'}`;
    } else if (activeSession) {
      canClockIn = false;
      reason = 'Already clocked in';
    } else if (currentSessionCount >= sessionLimit) {
      canClockIn = false;
      reason = `Maximum sessions per day (${sessionLimit}) reached`;
    }
    return {
      date: targetDate.toISOString().split('T')[0],
      status,
      canClockIn,
      reason: canClockIn ? 'Can clock in' : reason,
      isWeekend: isWeekendResult,
      isOnLeave: leaveResult.isOnLeave,
      leaveType: leaveResult.leaveType,
      currentSessions: currentSessionCount,
      maxSessions: sessionLimit,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            clockIn: activeSession.clockIn,
            sessionNumber: activeSession.sessionNumber,
          }
        : null,
      existingAttendance: existingAttendance.map((a) => ({
        id: a.id,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        sessionNumber: a.sessionNumber,
        sessionStatus: a.sessionStatus,
        workHours: a.workHours,
      })),
    };
  }
}
