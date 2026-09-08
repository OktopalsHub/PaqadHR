import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceExceptionStatus } from 'src/common/enums';
import { type FindOptionsWhere, In } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import type { ApproveAttendanceExceptionDto } from '../dto/approve-attendance-exception.dto';
import type { CreateAttendanceExceptionDto } from '../dto/create-attendance-exception.dto';
import type { RejectAttendanceExceptionDto } from '../dto/reject-attendance-exception.dto';
import { AttendanceException } from '../entities/attendance-exception.entity';
import { AttendanceExceptionRepository } from '../repositories/attendance-exception.repository';

@Injectable()
export class AttendanceExceptionService {
  constructor(
    private readonly exceptionRepo: AttendanceExceptionRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly notificationHelper: NotificationHelperService,
  ) {}

  async create(tenantId: string, tenantMemberId: string, dto: CreateAttendanceExceptionDto) {
    const exception = this.exceptionRepo.create({ ...dto, tenantMemberId, tenantId });
    return this.exceptionRepo.save(exception);
  }

  async findAll(
    tenantId: string,
    filters?: {
      tenantMemberIds?: string[];
      status?: AttendanceExceptionStatus;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: FindOptionsWhere<AttendanceException> = { tenantId };
    if (filters?.tenantMemberIds?.length) where.tenantMemberId = In(filters.tenantMemberIds);
    if (filters?.status) where.status = filters.status;
    return this.exceptionRepo.find({
      where,
      relations: ['tenantMember', 'approvedBy'],
      order: { date: 'DESC' },
    });
  }

  async findOne(tenantId: string, exceptionId: string) {
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId, tenantId },
      relations: ['tenantMember', 'approvedBy'],
    });
    if (!exception) throw new NotFoundException('Attendance exception not found');
    return exception;
  }

  async approve(
    tenantId: string,
    exceptionId: string,
    approvedById: string,
    dto: ApproveAttendanceExceptionDto,
  ) {
    const exception = await this.findOne(tenantId, exceptionId);
    if (exception.status !== AttendanceExceptionStatus.PENDING)
      throw new BadRequestException('Only pending exceptions can be approved');
    exception.status = AttendanceExceptionStatus.APPROVED;
    exception.approvedById = approvedById;
    exception.approvedAt = new Date();
    if (dto.comments) exception.reason = `${exception.reason} | Approved: ${dto.comments}`;
    const saved = await this.exceptionRepo.save(exception);
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: approvedById,
        action: 'attendance.exception_approved',
        resourceType: 'attendance_exception',
        resourceId: exceptionId,
        description: 'Attendance exception approved',
        metadata: { type: exception.type, date: exception.date },
      })
      .catch(() => {});
    void this.notificationHelper
      .sendAttendanceExceptionNotification(exception.tenantMemberId, tenantId, {
        status: 'approved',
        exceptionType: exception.type,
        date: exception.date.toISOString().split('T')[0],
      })
      .catch(() => {});
    return saved;
  }

  async reject(
    tenantId: string,
    exceptionId: string,
    dto: RejectAttendanceExceptionDto,
    approvedById: string,
  ) {
    const exception = await this.findOne(tenantId, exceptionId);
    if (exception.status !== AttendanceExceptionStatus.PENDING)
      throw new BadRequestException('Only pending exceptions can be rejected');
    exception.status = AttendanceExceptionStatus.REJECTED;
    exception.approvedById = approvedById;
    exception.approvedAt = new Date();
    exception.reason = `${exception.reason} | Rejected: ${dto.comments}`;
    const saved = await this.exceptionRepo.save(exception);
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: approvedById,
        action: 'attendance.exception_rejected',
        resourceType: 'attendance_exception',
        resourceId: exceptionId,
        description: 'Attendance exception rejected',
        metadata: { type: exception.type, date: exception.date, reason: dto.comments },
      })
      .catch(() => {});
    void this.notificationHelper
      .sendAttendanceExceptionNotification(exception.tenantMemberId, tenantId, {
        status: 'rejected',
        exceptionType: exception.type,
        date: exception.date.toISOString().split('T')[0],
        comments: dto.comments,
      })
      .catch(() => {});
    return saved;
  }
}
