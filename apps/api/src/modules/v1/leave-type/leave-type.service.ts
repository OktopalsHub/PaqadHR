import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveTypeCreatedEvent } from '../leave/events/leave.events';
import type { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import type { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveTypeRepository } from './leave-type.repository';

@Injectable()
export class LeaveTypeService {
  constructor(
    private readonly leaveTypeRepository: LeaveTypeRepository,
    private readonly eventEmitter: EventEmitter2,
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
  async updateLeaveType(tenantId: string, typeId: string, dto: UpdateLeaveTypeDto) {
    await this.getLeaveType(tenantId, typeId);
    await this.leaveTypeRepository.update(typeId, dto);
    return this.leaveTypeRepository.findOne({ where: { id: typeId, tenantId } });
  }
  async deleteLeaveType(tenantId: string, typeId: string) {
    await this.getLeaveType(tenantId, typeId);
    return this.leaveTypeRepository.softDelete(typeId);
  }
  async getActiveLeaveTypes(tenantId: string) {
    const leaveTypes = await this.listLeaveTypes(tenantId);
    return leaveTypes.filter((lt) => lt.isActive);
  }
}
