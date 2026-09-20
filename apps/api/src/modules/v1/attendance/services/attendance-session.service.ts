import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LessThan, QueryFailedError } from 'typeorm';
import { TenantMemberRepository } from '../../tenant-members/repositories/tenant-members.repository';
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
    private readonly tenantMemberRepository: TenantMemberRepository,
  ) {}

  async getTodayAttendance(tenantId: string, tenantMemberId: string) {
    try {
      const today = await this.eligibility.getTenantLocalDate(tenantId);
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
    const d = await this.eligibility.getTenantLocalDate(tenantId, date);
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
    const member = await this.tenantMemberRepository.findOne({
      where: { id: tenantMemberId, tenantId },
    });
    if (!member) {
      throw new NotFoundException('Tenant member not found');
    }

    const date = await this.eligibility.getTenantLocalDate(tenantId, dto.date);
    const sessions = await this.attendanceRepo.find({
      where: { tenantId, tenantMemberId, date },
      order: { sessionNumber: 'DESC' },
    });
    const sessionNumber = sessions.length ? sessions[0].sessionNumber + 1 : 1;
    let workHours: string | undefined;
    if (dto.clockIn && dto.clockOut) {
      const workMs = dto.clockOut.getTime() - dto.clockIn.getTime();
      if (workMs < 0) {
        throw new BadRequestException('Clock out time cannot be before clock in time.');
      }
      workHours = this.eligibility.formatDurationToHHMMSS(workMs);
    }
    try {
      return await this.attendanceRepo.save(
        this.attendanceRepo.create({
          tenantId,
          tenantMemberId,
          date,
          clockIn: dto.clockIn,
          clockOut: dto.clockOut,
          status: dto.status,
          sessionStatus: dto.clockOut ? 'CLOSED' : 'ACTIVE',
          sessionNumber,
          workHours,
          location: dto.location || 'Office',
          notes: dto.notes,
          entryMethod: 'manual',
          isManualEntry: true,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === '23505') {
        throw new ConflictException('You already have an active attendance session.');
      }
      throw error;
    }
  }

  async getClockInInfo(tenantId: string, tenantMemberId: string, targetDate?: Date) {
    const date = targetDate
      ? await this.eligibility.getTenantLocalDate(tenantId, targetDate)
      : await this.eligibility.getTenantLocalDate(tenantId);
    const [clockInEnabled, isWeekendDay, leaveStatus] = await Promise.all([
      this.eligibility.isClockInEnabled(tenantId),
      this.eligibility.isWeekend(tenantId, targetDate ?? new Date()),
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
