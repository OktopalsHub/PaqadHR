import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivitiesService } from '../activities/services/activities.service';
import { LeaveTypeCreatedEvent } from '../leave/events/leave.events';
import type { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import type { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveTypeRepository } from './leave-type.repository';

@Injectable()
export class LeaveTypeService {
  constructor(
    private readonly leaveTypeRepository: LeaveTypeRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly activitiesService: ActivitiesService,
  ) {}
  async createLeaveType(tenantId: string, memberId: string, dto: CreateLeaveTypeDto) {
    const leaveType = await this.leaveTypeRepository.save({
      ...dto,
      tenantId,
      tenantMemberId: memberId,
    });
    this.eventEmitter.emit(
      'leave.type.created',
      new LeaveTypeCreatedEvent(tenantId, leaveType.id, dto.defaultDays),
    );
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'leave.type_created',
        resourceType: 'leave_type',
        resourceId: leaveType.id,
        description: `Leave type "${dto.name}" created`,
        metadata: { name: dto.name, defaultDays: dto.defaultDays },
      })
      .catch(() => {});
    return leaveType;
  }
  async listLeaveTypes(tenantId: string) {
    return this.leaveTypeRepository.findAll(false, { tenantId });
  }
  async getLeaveType(tenantId: string, typeId: string) {
    const leaveType = await this.leaveTypeRepository.findById(typeId, false, {
      tenantId,
    });
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }
    return leaveType;
  }
  async updateLeaveType(
    tenantId: string,
    typeId: string,
    dto: UpdateLeaveTypeDto,
    actorMemberId?: string,
  ) {
    await this.getLeaveType(tenantId, typeId);
    await this.leaveTypeRepository.update(typeId, dto);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave.type_updated',
          resourceType: 'leave_type',
          resourceId: typeId,
          description: `Leave type updated`,
          metadata: { changes: dto },
        })
        .catch(() => {});
    }
    return this.leaveTypeRepository.findOne({ where: { id: typeId, tenantId } });
  }
  async deleteLeaveType(tenantId: string, typeId: string, actorMemberId?: string) {
    const existing = await this.getLeaveType(tenantId, typeId);
    await this.leaveTypeRepository.softDelete(typeId);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave.type_deleted',
          resourceType: 'leave_type',
          resourceId: typeId,
          description: `Leave type "${existing.name}" deleted`,
          metadata: { name: existing.name },
        })
        .catch(() => {});
    }
  }
  async getActiveLeaveTypes(tenantId: string) {
    const leaveTypes = await this.listLeaveTypes(tenantId);
    return leaveTypes.filter((lt) => lt.isActive);
  }
}
