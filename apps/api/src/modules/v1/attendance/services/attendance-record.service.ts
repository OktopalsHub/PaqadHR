import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';
import type { GetAttendanceRecordsDto } from '../dto/get-attendance-records.dto';
import type { UpdateAttendanceDto } from '../dto/update-attendance.dto';

/**
 * Handles attendance record management.
 */
@Injectable()
export class AttendanceRecordService {
  private readonly logger = new Logger(AttendanceRecordService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
  ) { }

  async getAttendanceRecords(
    tenantId: string,
    dto: GetAttendanceRecordsDto,
  ): Promise<{ records: Attendance[]; total: number }> {
    const { page = 1, limit = 20, memberId, startDate, endDate, status } = dto;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (memberId) {
      where.memberId = memberId;
    }

    if (startDate && endDate) {
      where.clockInAt = Between(startDate, endDate);
    } else if (startDate) {
      where.clockInAt = { $gte: startDate };
    } else if (endDate) {
      where.clockInAt = { $lte: endDate };
    }

    if (status) {
      where.status = status;
    }

    const [records, total] = await this.attendanceRepository.findAndCount({
      where,
      order: { clockInAt: 'DESC' },
      skip,
      take: limit,
      relations: ['member'],
    });

    return { records, total };
  }

  async getAttendance(tenantId: string, attendanceId: string): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId, tenantId },
      relations: ['member'],
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    return attendance;
  }

  async updateAttendance(
    tenantId: string,
    attendanceId: string,
    dto: UpdateAttendanceDto,
  ): Promise<Attendance> {
    const attendance = await this.getAttendance(tenantId, attendanceId);

    // Validate updates
    if (dto.clockInAt && dto.clockOutAt) {
      const clockIn = new Date(dto.clockInAt);
      const clockOut = new Date(dto.clockOutAt);

      if (clockOut < clockIn) {
        throw new BadRequestException('Clock-out time cannot be before clock-in time');
      }

      const totalMs = clockOut.getTime() - clockIn.getTime();
      attendance.totalHours = totalMs / (1000 * 60 * 60);
      attendance.totalHoursFormatted = this.formatTimeToHHMMSS(totalMs);
    }

    // Update fields
    if (dto.clockInAt !== undefined) attendance.clockInAt = dto.clockInAt;
    if (dto.clockOutAt !== undefined) attendance.clockOutAt = dto.clockOutAt;
    if (dto.clockInLocation !== undefined) attendance.clockInLocation = dto.clockInLocation;
    if (dto.clockOutLocation !== undefined) attendance.clockOutLocation = dto.clockOutLocation;
    if (dto.clockInRemarks !== undefined) attendance.clockInRemarks = dto.clockInRemarks;
    if (dto.clockOutRemarks !== undefined) attendance.clockOutRemarks = dto.clockOutRemarks;
    if (dto.status !== undefined) attendance.status = dto.status;

    return await this.attendanceRepository.save(attendance);
  }

  async deleteAttendance(tenantId: string, attendanceId: string): Promise<void> {
    const attendance = await this.getAttendance(tenantId, attendanceId);
    await this.attendanceRepository.remove(attendance);
  }

  async getCurrentSessionCount(
    tenantId: string,
    memberId?: string,
  ): Promise<{ total: number; active: number }> {
    const where: any = { tenantId, clockOutAt: null };

    if (memberId) {
      where.memberId = memberId;
    }

    const activeSessions = await this.attendanceRepository.count({ where });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    where.clockInAt = { $gte: today, $lt: tomorrow };
    const totalSessions = await this.attendanceRepository.count({ where });

    return { total: totalSessions, active: activeSessions };
  }

  private formatTimeToHHMMSS(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
