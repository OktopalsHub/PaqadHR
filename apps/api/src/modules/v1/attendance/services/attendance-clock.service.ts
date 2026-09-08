import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { LessThan } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { ClockInDto } from '../dto/clock-in.dto';
import type { ClockOutDto } from '../dto/clock-out.dto';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendancePolicyRepository } from '../repositories/attendance-policy.repository';
import { AttendanceEligibilityService } from './attendance-eligibility.service';

@Injectable()
export class AttendanceClockService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly policyRepo: AttendancePolicyRepository,
    private readonly eligibility: AttendanceEligibilityService,
    private readonly activitiesService: ActivitiesService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

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
    if (!(await this.eligibility.isClockInEnabled(tenantId)))
      throw new ConflictException('Clock in is disabled for this workspace.');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (await this.eligibility.isWeekend(tenantId, today))
      throw new ConflictException('Cannot clock in on weekends.');
    const leave = await this.eligibility.isOnLeave(tenantId, tenantMemberId, today);
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
    const workHours = this.eligibility.formatDurationToHHMMSS(workMs);
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
}
