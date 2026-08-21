import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';
import { AttendancePolicy } from '../entities/attendance-policy.entity';
import { Member } from '../../members/entities/member.entity';
import type { ClockInDto } from '../dto/clock-in.dto';
import type { ClockOutDto } from '../dto/clock-out.dto';
import { AttendancePolicyService } from './attendance-policy.service';

/**
 * Handles clock in/out operations.
 */
@Injectable()
export class AttendanceClockService {
  private readonly logger = new Logger(AttendanceClockService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(AttendancePolicy)
    private readonly policyRepository: Repository<AttendancePolicy>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly policyService: AttendancePolicyService,
  ) { }

  async clockIn(
    tenantId: string,
    tenantMemberId: string,
    dto: ClockInDto,
  ): Promise<Attendance> {
    // Check if clock-in is enabled for this tenant
    const isClockInEnabled = await this.policyService.isClockInEnabled(tenantId);
    if (!isClockInEnabled) {
      throw new BadRequestException('Clock-in functionality is disabled for this workspace');
    }

    // Check if member exists
    const member = await this.memberRepository.findOne({
      where: { id: tenantMemberId, tenantId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Check if already clocked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await this.attendanceRepository.findOne({
      where: {
        tenantId,
        memberId: tenantMemberId,
        clockInAt: {
          $gte: today,
          $lt: tomorrow,
        },
        clockOutAt: null,
      },
    });

    if (existingAttendance) {
      throw new BadRequestException('You are already clocked in for today');
    }

    // Create attendance record
    const attendanceData = {
      tenantId,
      memberId: tenantMemberId,
      clockInAt: new Date(),
      clockInLocation: dto.location,
      clockInRemarks: dto.remarks,
      status: 'PRESENT',
    };

    const attendance = this.attendanceRepository.create(attendanceData);
    return await this.attendanceRepository.save(attendance);
  }

  async clockOut(
    tenantId: string,
    tenantMemberId: string,
    attendanceId: string,
    dto: ClockOutDto,
  ): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId, tenantId, memberId: tenantMemberId },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    if (attendance.clockOutAt) {
      throw new BadRequestException('Already clocked out');
    }

    attendance.clockOutAt = new Date();
    attendance.clockOutLocation = dto.location;
    attendance.clockOutRemarks = dto.remarks;

    // Calculate total hours worked
    if (attendance.clockInAt) {
      const totalMs = attendance.clockOutAt.getTime() - attendance.clockInAt.getTime();
      attendance.totalHours = totalMs / (1000 * 60 * 60); // Convert ms to hours
      attendance.totalHoursFormatted = this.formatTimeToHHMMSS(totalMs);
    }

    return await this.attendanceRepository.save(attendance);
  }

  private formatTimeToHHMMSS(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  async getTodayAttendance(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<Attendance | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.attendanceRepository.findOne({
      where: {
        tenantId,
        memberId: tenantMemberId,
        clockInAt: {
          $gte: today,
          $lt: tomorrow,
        },
      },
    });
  }

  async getClockInInfo(
    tenantId: string,
    tenantMemberId: string,
    date: Date = new Date(),
  ): Promise<{ canClockIn: boolean; message?: string; currentSession?: Attendance }> {
    // Check if clock-in is enabled
    const isClockInEnabled = await this.policyService.isClockInEnabled(tenantId);
    if (!isClockInEnabled) {
      return { canClockIn: false, message: 'Clock-in functionality is disabled' };
    }

    // Check if already clocked in today
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentAttendance = await this.attendanceRepository.findOne({
      where: {
        tenantId,
        memberId: tenantMemberId,
        clockInAt: {
          $gte: today,
          $lt: tomorrow,
        },
        clockOutAt: null,
      },
    });

    if (currentAttendance) {
      return { canClockIn: false, message: 'Already clocked in today', currentSession: currentAttendance };
    }

    return { canClockIn: true };
  }
}
