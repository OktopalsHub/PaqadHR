import { Leave } from '../leave/entities/leave.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveTypeRepository } from './leave-type.repository';
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { LeaveTypeCreatedEvent } from "../leave/events/leave.events";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";

@Injectable()
export class LeaveTypeService {
  constructor(
    private readonly leaveTypeRepository: LeaveTypeRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async createLeaveType(
    tenantId: string,
    memberId: string,
    dto: CreateLeaveTypeDto,
  ) {
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
  async updateLeaveType(
    typeId: string,
    dto: UpdateLeaveTypeDto,
    tenantId: string,
  ) {
    await this.getLeaveType(typeId, tenantId);
    await this.leaveTypeRepository.update(typeId,  dto);
    return this.leaveTypeRepository.findOne({ where: { id: typeId } });
  }
  async deleteLeaveType(typeId: string, tenantId: string) {
    await this.getLeaveType(typeId, tenantId);
    return this.leaveTypeRepository.softDelete(typeId);
  }
  async getActiveLeaveTypes(tenantId: string) {
    const leaveTypes = await this.listLeaveTypes(tenantId);
    return leaveTypes.filter((lt) => lt.isActive);
  }
}
