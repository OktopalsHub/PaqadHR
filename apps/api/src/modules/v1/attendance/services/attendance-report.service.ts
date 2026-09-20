import { Injectable, Logger } from '@nestjs/common';
import { Between, In } from 'typeorm';
import { LeaveService } from '../../leave/leave.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { DepartmentUtils } from '../utils/department.utils';

@Injectable()
export class AttendanceReportService {
  private readonly logger = new Logger(AttendanceReportService.name);

  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly leaveService: LeaveService,
    private readonly departmentUtils: DepartmentUtils,
  ) {}

  private async toTenantDayBoundary(
    tenantId: string,
    date: Date,
    endOfDay: boolean,
    targetMonth?: number,
    targetYear?: number,
  ): Promise<Date> {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const timezone = settings.settings.general?.timezone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = targetYear ?? Number(values.year);
    const month = targetMonth ?? Number(values.month);
    const day =
      targetMonth && targetYear
        ? new Date(Date.UTC(year, month, 0)).getUTCDate()
        : Number(values.day);
    const hour = endOfDay ? 23 : 0;
    const minute = endOfDay ? 59 : 0;
    const second = endOfDay ? 59 : 0;
    const millisecond = endOfDay ? 999 : 0;
    const wallClock = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    const offsetParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(wallClock));
    const offsetValues = Object.fromEntries(
      offsetParts.map((part) => [part.type, part.value]),
    );
    const representedWallClock = Date.UTC(
      Number(offsetValues.year),
      Number(offsetValues.month) - 1,
      Number(offsetValues.day),
      Number(offsetValues.hour),
      Number(offsetValues.minute),
      Number(offsetValues.second),
      millisecond,
    );
    const offset = representedWallClock - wallClock;
    return new Date(wallClock - offset);
  }

  async getDailyReport(tenantId: string, date: Date) {
    try {
      const start = await this.toTenantDayBoundary(tenantId, date, false);
      const end = await this.toTenantDayBoundary(tenantId, date, true);
      const attendances = await this.attendanceRepo.find({
        where: { tenantId, date: Between(start, end) },
        relations: ['tenantMember', 'tenantMember.user'],
      });
      const memberIds = [
        ...new Set(attendances.map((a) => a.tenantMember?.id).filter((id): id is string => !!id)),
      ];
      const departmentMap = await this.departmentUtils.getDepartmentsByMemberIds(
        tenantId,
        memberIds,
      );
      const transformed = attendances.map((a) => {
        const m = a.tenantMember;
        const d = m ? (departmentMap.get(m.id) ?? null) : null;
        return {
          ...a,
          member: m
            ? {
                id: m.id,
                firstName: m.firstName,
                lastName: m.lastName,
                email: m.user?.email || null,
                department: this.departmentUtils.formatDepartmentResponse(d),
                avatar: m.avatarKey,
                role: m.role,
                employeeNumber: m.employeeNumber,
                status: m.isActive ? 'ACTIVE' : 'INACTIVE',
              }
            : null,
        };
      });
      const totalEmployees = await this.tenantMembersService.getTenantMembersCount(tenantId);
      const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
      return {
        date: date.toISOString().split('T')[0],
        totalEmployees,
        presentCount,
        absentCount: attendances.filter((a) => a.status === 'ABSENT').length,
        lateCount: attendances.filter((a) => a.status === 'LATE').length,
        onLeaveCount: attendances.filter((a) => a.status === 'ON_LEAVE').length,
        attendanceRate: totalEmployees > 0 ? (presentCount / totalEmployees) * 100 : 0,
        attendances: transformed,
      };
    } catch (error) {
      this.logger.error('getDailyAttendanceReport failed', error);
      throw error;
    }
  }

  async getMonthlyReport(tenantId: string, month: number, year: number) {
    const start = await this.toTenantDayBoundary(tenantId, new Date(Date.UTC(year, month - 1, 1)), false);
    const end = await this.toTenantDayBoundary(
      tenantId,
      new Date(Date.UTC(year, month - 1, 1)),
      true,
      month,
      year,
    );
    const attendances = await this.attendanceRepo.find({
      where: { tenantId, date: Between(start, end) },
      relations: ['tenantMember'],
    });
    const totalEmployees = await this.tenantMembersService.getTenantMembersCount(tenantId);
    const workingDays = await this.getWorkingDaysInMonth(tenantId, year, month);
    const totalExpected = totalEmployees * workingDays;
    const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
    return {
      month,
      year,
      totalEmployees,
      workingDays,
      totalExpectedAttendance: totalExpected,
      presentCount,
      absentCount: attendances.filter((a) => a.status === 'ABSENT').length,
      lateCount: attendances.filter((a) => a.status === 'LATE').length,
      onLeaveCount: attendances.filter((a) => a.status === 'ON_LEAVE').length,
      attendanceRate: totalExpected > 0 ? (presentCount / totalExpected) * 100 : 0,
      attendances,
    };
  }

  async getEmployeeReport(tenantId: string, memberId: string, startDate: Date, endDate: Date) {
    const attendances = await this.attendanceRepo.find({
      where: { tenantId, tenantMemberId: memberId, date: Between(startDate, endDate) },
      relations: ['tenantMember'],
    });
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
    return {
      memberId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays,
      presentCount,
      absentCount: attendances.filter((a) => a.status === 'ABSENT').length,
      lateCount: attendances.filter((a) => a.status === 'LATE').length,
      onLeaveCount: attendances.filter((a) => a.status === 'ON_LEAVE').length,
      attendanceRate: totalDays > 0 ? (presentCount / totalDays) * 100 : 0,
      attendances,
    };
  }

  async getStats(tenantId: string, startDate: Date, endDate: Date) {
    const attendances = await this.attendanceRepo.find({
      where: { tenantId, date: Between(startDate, endDate) },
      relations: ['tenantMember'],
    });
    return {
      totalPresent: attendances.filter((a) => a.status === 'PRESENT').length,
      totalAbsent: attendances.filter((a) => a.status === 'ABSENT').length,
      totalLate: attendances.filter((a) => a.status === 'LATE').length,
      totalHalfDay: attendances.filter((a) => a.status === 'HALF_DAY').length,
      totalOnLeave: attendances.filter((a) => a.status === 'ON_LEAVE').length,
      totalRecords: attendances.length,
    };
  }

  async getMonthlyForAllMembers(
    tenantId: string,
    month: number,
    year: number,
    page = 1,
    limit = 20,
    memberIds?: string[],
  ) {
    const allMembers = await this.tenantMembersService.getTenantMembers(tenantId);
    let filteredMembers = allMembers.filter((m) => m.isActive);
    if (memberIds?.length)
      filteredMembers = filteredMembers.filter((m) => memberIds.includes(m.id));
    const totalMembers = filteredMembers.length;
    const startOfMonth = await this.toTenantDayBoundary(
      tenantId,
      new Date(Date.UTC(year, month - 1, 1)),
      false,
    );
    const endOfMonth = await this.toTenantDayBoundary(
      tenantId,
      new Date(Date.UTC(year, month - 1, 1)),
      true,
      month,
      year,
    );
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const tenantSettings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const weekends = tenantSettings?.settings?.attendance?.weekends || [0, 6];
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      if (!weekends.includes(date.getUTCDay())) workingDays++;
    }

    const paginatedMembers = filteredMembers.slice((page - 1) * limit, page * limit);
    const paginatedIds = paginatedMembers.map((m) => m.id);

    if (paginatedIds.length === 0) {
      return {
        month,
        year,
        pagination: {
          page,
          limit,
          total: totalMembers,
          pageCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        summary: { totalMembers, daysInMonth, workingDays },
        members: [],
      };
    }

    const [attendanceRecords, departmentMap] = await Promise.all([
      this.attendanceRepo.find({
        where: {
          tenantId,
          tenantMemberId: In(paginatedIds),
          date: Between(startOfMonth, endOfMonth),
        },
      }),
      this.departmentUtils.getDepartmentsByMemberIds(tenantId, paginatedIds),
    ]);

    const attendanceByMember = new Map<string, typeof attendanceRecords>();
    for (const record of attendanceRecords) {
      const list = attendanceByMember.get(record.tenantMemberId) ?? [];
      list.push(record);
      attendanceByMember.set(record.tenantMemberId, list);
    }

    const leavePromises = paginatedMembers.map(async (m) => ({
      memberId: m.id,
      leaves: await this.leaveService
        .getLeavesByMember(tenantId, m.id, { page: 1, limit: 100 })
        .then((r) => r.records.filter((l) => l.status === 'APPROVED')),
    }));
    const allLeaves = await Promise.all(leavePromises);
    const leavesByMember = new Map(allLeaves.map((l) => [l.memberId, l.leaves]));

    const members = paginatedMembers.map((member) => {
      const memberAttendance = attendanceByMember.get(member.id) ?? [];
      const memberLeaves = leavesByMember.get(member.id) ?? [];
      const dailyAttendance: Array<{
        date: string;
        day: number;
        dayOfWeek: string;
        status: string;
        isWeekend?: boolean;
        isOnLeave?: boolean;
        clockIn?: string;
        clockOut?: string;
        workHours?: string;
        sessionNumber?: number;
        notes?: string;
        leaveType?: string;
        attendance: Array<{
          id: string;
          clockIn: string | null;
          clockOut: string | null;
          workHours: string | null;
          sessionNumber: number;
          sessionStatus: string;
        }>;
      }> = [];
      let presentDays = 0,
        absentDays = 0,
        weekendDays = 0,
        leaveDays = 0,
        workingDaysCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(Date.UTC(year, month - 1, d));
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        if (weekends.includes(date.getUTCDay())) {
          weekendDays++;
          dailyAttendance.push({
            date: dateStr,
            day: d,
            dayOfWeek,
            status: 'WEEKEND',
            isWeekend: true,
            attendance: [],
          });
          continue;
        }
        workingDaysCount++;
        const leave = memberLeaves.find((l) => {
          const leaveStart = new Date(l.startDate).toISOString().slice(0, 10);
          const leaveEnd = new Date(l.endDate).toISOString().slice(0, 10);
          return dateStr >= leaveStart && dateStr <= leaveEnd;
        });
        if (leave) {
          leaveDays++;
          dailyAttendance.push({
            date: dateStr,
            day: d,
            dayOfWeek,
            status: 'ON_LEAVE',
            isOnLeave: true,
            leaveType: leave.leaveType?.name,
            attendance: [],
          });
          continue;
        }
        const dayRecords = memberAttendance.filter(
          (a) => new Date(a.date).toISOString().slice(0, 10) === dateStr,
        );
        if (dayRecords.length > 0) {
          const r = dayRecords[0];
          const s = r.status === 'PRESENT' || r.status === 'LATE' ? r.status : 'WORKING_DAY';
          if (s === 'PRESENT' || s === 'LATE') presentDays++;
          else absentDays++;
          dailyAttendance.push({
            date: dateStr,
            day: d,
            dayOfWeek,
            status: s,
            clockIn: r.clockIn?.toISOString(),
            clockOut: r.clockOut?.toISOString(),
            workHours: r.workHours,
            sessionNumber: r.sessionNumber,
            notes: r.notes,
            attendance: dayRecords.map((record) => ({
              id: record.id,
              clockIn: record.clockIn?.toISOString() ?? null,
              clockOut: record.clockOut?.toISOString() ?? null,
              workHours: record.workHours ?? null,
              sessionNumber: record.sessionNumber,
              sessionStatus: record.sessionStatus,
            })),
          });
        } else {
          absentDays++;
          dailyAttendance.push({
            date: dateStr,
            day: d,
            dayOfWeek,
            status: 'ABSENT',
            attendance: [],
          });
        }
      }

      const attendanceRate = workingDaysCount > 0 ? (presentDays / workingDaysCount) * 100 : 0;
      const department = departmentMap.get(member.id) ?? null;
      return {
        // Keep the original flat fields below for existing API consumers, while
        // exposing the structured member data used by the web timesheet.
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          employeeNumber: member.employeeNumber,
        },
        memberId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        employeeNumber: member.employeeNumber,
        department: this.departmentUtils.formatDepartmentResponse(department),
        dailyAttendance,
        statistics: {
          totalDays: daysInMonth,
          presentDays,
          absentDays,
          weekendDays,
          leaveDays,
          workingDays: workingDaysCount,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
        },
      };
    });

    const pageCount = Math.ceil(totalMembers / limit) || 1;
    return {
      month,
      year,
      pagination: {
        page,
        limit,
        total: totalMembers,
        pageCount,
        totalPages: pageCount,
        hasNext: page < pageCount,
        hasPrev: page > 1,
      },
      summary: { totalMembers, daysInMonth, workingDays },
      members,
    };
  }

  private async getWorkingDaysInMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    let workingDays = 0;
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const weekends = settings?.settings?.attendance?.weekends || [0, 6];
    for (let d = 1; d <= daysInMonth; d++) {
      if (!weekends.includes(new Date(Date.UTC(year, month - 1, d)).getUTCDay())) workingDays++;
    }
    return workingDays;
  }
}
