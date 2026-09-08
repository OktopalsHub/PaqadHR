import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { LessThan } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { LeaveService } from '../../leave/leave.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import type { ClockInDto } from '../dto/clock-in.dto';
import type { ClockOutDto } from '../dto/clock-out.dto';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendancePolicyRepository } from '../repositories/attendance-policy.repository';

@Injectable()
export class AttendanceClockService {
  private readonly logger = new Logger(AttendanceClockService.name);

  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly policyRepo: AttendancePolicyRepository,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly leaveService: LeaveService,
    private readonly activitiesService: ActivitiesService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  private formatTimeToHHMMSS(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private async isWeekend(tenantId: string, date: Date): Promise<boolean> {
    try {
      const s = await this.tenantSettingsService.getTenantSettings(tenantId);
      return (s.settings.attendance?.weekends || [0, 6]).includes(date.getDay());
    } catch {
      return [0, 6].includes(date.getDay());
    }
  }

  private async isOnLeave(
    tenantId: string,
    memberId: string,
    date: Date,
  ): Promise<{ isOnLeave: boolean; leaveType?: string }> {
    try {
      const leaves = await this.leaveService.getLeavesByMember(tenantId, memberId, {
        page: 1,
        limit: 100,
      });
      for (const l of leaves.records) {
        if (l.status === 'APPROVED' && date >= new Date(l.startDate) && date <= new Date(l.endDate))
          return { isOnLeave: true, leaveType: l.leaveType?.name };
      }
      return { isOnLeave: false };
    } catch {
      return { isOnLeave: false };
    }
  }

  private async isClockInEnabled(tenantId: string): Promise<boolean> {
    try {
      const s = await this.tenantSettingsService.getTenantSettings(tenantId);
      return s.settings.attendance?.clockInEnabled === true;
    } catch {
      return false;
    }
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
    if (!(await this.isClockInEnabled(tenantId)))
      throw new ConflictException('Clock in is disabled for this workspace.');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (await this.isWeekend(tenantId, today))
      throw new ConflictException('Cannot clock in on weekends.');
    const leave = await this.isOnLeave(tenantId, tenantMemberId, today);
    if (leave.isOnLeave)
      throw new ConflictException(
        `Cannot clock in while on leave${leave.leaveType ? `: ${leave.leaveType}` : ''}.`,
      );
    if (
      await this.attendanceRepo.findOne({
        where: { tenantId, tenantMemberId, sessionStatus: 'ACTIVE', date: LessThan(today) },
      })
    )
      throw new ConflictException(
        'You have an unclosed attendance session from a previous day. Please close it first.',
      );
    if (
      await this.attendanceRepo.findOne({
        where: { tenantId, tenantMemberId, date: today, sessionStatus: 'ACTIVE' },
      })
    )
      throw new ConflictException('You already have an active session. Please clock out first.');
    const policy = await this.policyRepo.findOne({ where: { tenantId, isActive: true } });
    const maxSessions = policy?.maxSessionsPerDay || 3;
    const todaySessions = await this.attendanceRepo.find({
      where: { tenantId, tenantMemberId, date: today },
      order: { sessionNumber: 'DESC' },
    });
    const nextSession =
      todaySessions.length > 0 ? Math.max(...todaySessions.map((s) => s.sessionNumber)) + 1 : 1;
    if (nextSession > maxSessions)
      throw new ConflictException(`Maximum sessions per day (${maxSessions}) reached.`);
    const attendance = await this.attendanceRepo.save(
      this.attendanceRepo.create({
        tenantId,
        tenantMemberId,
        date: today,
        clockIn: new Date(),
        status: 'PRESENT',
        sessionStatus: 'ACTIVE',
        sessionNumber: nextSession,
        location: dto.location || 'Office',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        deviceType: metadata?.deviceType,
        entryMethod: 'auto',
        isManualEntry: false,
      }),
    );
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: tenantMemberId,
        action: 'attendance.clocked_in',
        resourceType: 'attendance',
        resourceId: attendance.id,
        description: `Clocked in at ${dto.location || 'Office'}`,
        metadata: { location: dto.location, sessionNumber: nextSession },
      })
      .catch(() => {});
    this.productAnalytics.capture(tenantMemberId, 'attendance_clocked_in', { tenantId });
    return attendance;
  }

  async clockOut(tenantId: string, tenantMemberId: string, attendanceId: string, dto: ClockOutDto) {
    const attendance = await this.attendanceRepo.findOne({
      where: { id: attendanceId, tenantId, tenantMemberId, sessionStatus: 'ACTIVE' },
    });
    if (!attendance) throw new NotFoundException('Active attendance session not found.');
    if (!attendance.clockIn) throw new ConflictException('Cannot clock out without clock in time.');
    const clockOutTime = dto.clockOut ? new Date(dto.clockOut) : new Date();
    if (Number.isNaN(clockOutTime.getTime()))
      throw new BadRequestException('Invalid clock out time');
    const clockInTime = new Date(attendance.clockIn);
    if (Number.isNaN(clockInTime.getTime()))
      throw new ConflictException('Invalid clock in time format.');
    const workMs = clockOutTime.getTime() - clockInTime.getTime();
    if (workMs < 0) throw new BadRequestException('Clock out time cannot be before clock in time.');
    const workHours = this.formatTimeToHHMMSS(workMs);
    await this.attendanceRepo.update(attendanceId, {
      clockOut: clockOutTime,
      sessionStatus: 'CLOSED',
      workHours,
      location: dto.location || attendance.location,
      notes: dto.notes,
      entryMethod: 'auto',
    });
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: tenantMemberId,
        action: 'attendance.clocked_out',
        resourceType: 'attendance',
        resourceId: attendanceId,
        description: `Clocked out after ${workHours}`,
        metadata: { workHours, location: dto.location },
      })
      .catch(() => {});
    return this.attendanceRepo.findOne({ where: { id: attendanceId, tenantId } });
  }

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
      workHours = this.formatTimeToHHMMSS(dto.clockOut.getTime() - dto.clockIn.getTime());
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
      this.isClockInEnabled(tenantId),
      this.isWeekend(tenantId, date),
      this.isOnLeave(tenantId, tenantMemberId, date),
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
