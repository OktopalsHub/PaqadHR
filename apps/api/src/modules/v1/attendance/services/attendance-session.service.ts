import { Injectable, Logger } from '@nestjs/common';
import { LessThan } from 'typeorm';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendancePolicyRepository } from '../repositories/attendance-policy.repository';
import { AttendanceEligibilityService } from './attendance-eligibility.service';

@Injectable()
export class AttendanceSessionService {
  private readonly logger = new Logger(AttendanceSessionService.name);

  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly policyRepo: AttendancePolicyRepository,
    private readonly eligibility: AttendanceEligibilityService,
  ) {}

  async getTodayAttendance(tenantId: string, tenantMemberId: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendances = await this.attendanceRepo.find({
        where: { tenantId, tenantMemberId, date: today },
        order: { sessionNumber: 'ASC' },
      });
      if (attendances.length === 0) return null;
      return (
        attendances.find((a) => a.sessionStatus === 'ACTIVE') ?? attendances[attendances.length - 1]
      );
    } catch (error) {
      this.logger.error('getTodayAttendance failed', error);
      throw error;
    }
  }

  async getSessionLimit(tenantId: string): Promise<number> {
    const p = await this.policyRepo.findOne({ where: { tenantId, isActive: true } });
    return p?.maxSessionsPerDay || 3;
  }

  async getCurrentSessionCount(
    tenantId: string,
    tenantMemberId: string,
    date: Date = new Date(),
  ): Promise<number> {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return (await this.attendanceRepo.find({ where: { tenantId, tenantMemberId, date: d } }))
      .length;
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
    if (dto.clockIn && dto.clockOut)
      workHours = this.eligibility.formatDurationToHHMMSS(
        dto.clockOut.getTime() - dto.clockIn.getTime(),
      );
    return this.attendanceRepo.create({
      tenantId,
      tenantMemberId,
      date: dto.date,
      clockIn: dto.clockIn,
      clockOut: dto.clockOut,
      status: dto.status,
      sessionStatus: dto.clockOut ? 'CLOSED' : 'ACTIVE',
      sessionNumber: 1,
      workHours,
      location: dto.location || 'Office',
      notes: dto.notes,
      entryMethod: 'manual',
      isManualEntry: true,
    });
  }

  async getClockInInfo(tenantId: string, tenantMemberId: string, targetDate?: Date) {
    const date = targetDate ? new Date(targetDate) : new Date();
    date.setHours(0, 0, 0, 0);
    const [clockInEnabled, isWeekendDay, leaveStatus] = await Promise.all([
      this.eligibility.isClockInEnabled(tenantId),
      this.eligibility.isWeekend(tenantId, date),
      this.eligibility.isOnLeave(tenantId, tenantMemberId, date),
    ]);
    const forgottenSession = await this.attendanceRepo.findOne({
      where: { tenantId, tenantMemberId, sessionStatus: 'ACTIVE', date: LessThan(date) },
    });
    const todaySessions = await this.attendanceRepo.find({
      where: { tenantId, tenantMemberId, date },
    });
    const activeSession = todaySessions.find((a) => a.sessionStatus === 'ACTIVE');
    const maxSessions = await this.getSessionLimit(tenantId);
    const sessionCount = todaySessions.length;

    let status = 'AVAILABLE';
    let canClockIn = true;
    let reason: string | undefined;

    if (!clockInEnabled) {
      status = 'DISABLED';
      canClockIn = false;
      reason = 'Clock-in is disabled for this workspace.';
    } else if (isWeekendDay) {
      status = 'WEEKEND';
      canClockIn = false;
      reason = 'Today is a weekend. Clock-in is not available.';
    } else if (leaveStatus.isOnLeave) {
      status = 'ON_LEAVE';
      canClockIn = false;
      reason = `You are on leave${leaveStatus.leaveType ? ` (${leaveStatus.leaveType})` : ''}.`;
    } else if (forgottenSession) {
      status = 'FORGOTTEN_SESSION';
      canClockIn = false;
      reason = 'You have an unclosed session from a previous day. Please close it first.';
    } else if (activeSession) {
      status = 'ALREADY_CLOCKED_IN';
      canClockIn = false;
      reason = 'You already have an active session. Please clock out first.';
    } else if (sessionCount >= maxSessions) {
      status = 'MAX_SESSIONS';
      canClockIn = false;
      reason = `Maximum sessions per day (${maxSessions}) reached.`;
    }

    return {
      date: date.toISOString().split('T')[0],
      status,
      clockInEnabled,
      canClockIn,
      reason,
      isWeekend: isWeekendDay,
      isOnLeave: leaveStatus.isOnLeave,
      leaveType: leaveStatus.leaveType,
      currentSessions: sessionCount,
      maxSessions,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            clockIn: activeSession.clockIn,
            sessionNumber: activeSession.sessionNumber,
          }
        : null,
      forgottenSession: forgottenSession
        ? {
            id: forgottenSession.id,
            clockIn: forgottenSession.clockIn,
            date: forgottenSession.date,
          }
        : null,
      attendances: todaySessions,
    };
  }
}
