import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { CreateAttendancePolicyDto } from '../dto/create-attendance-policy.dto';
import type { UpdateAttendancePolicyDto } from '../dto/update-attendance-policy.dto';
import { AttendancePolicyRepository } from '../repositories/attendance-policy.repository';

@Injectable()
export class AttendancePolicyService {
  constructor(
    private readonly policyRepo: AttendancePolicyRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async create(tenantId: string, dto: CreateAttendancePolicyDto, actorMemberId?: string) {
    const policy = await this.policyRepo.create({ ...dto, tenantId });
    const saved = await this.policyRepo.save(policy);
    if (actorMemberId)
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'attendance.policy_created',
          resourceType: 'attendance_policy',
          resourceId: saved.id,
          description: 'Attendance policy created',
          metadata: { name: dto.name },
        })
        .catch(() => {});
    return saved;
  }

  async findAll(tenantId: string) {
    return this.policyRepo.find({ where: { tenantId } });
  }

  async findOne(tenantId: string, policyId: string) {
    const policy = await this.policyRepo.findOne({ where: { id: policyId, tenantId } });
    if (!policy) throw new NotFoundException('Attendance policy not found');
    return policy;
  }

  async update(
    tenantId: string,
    policyId: string,
    dto: UpdateAttendancePolicyDto,
    actorMemberId?: string,
  ) {
    await this.findOne(tenantId, policyId);
    await this.policyRepo.update(policyId, dto);
    if (actorMemberId)
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'attendance.policy_updated',
          resourceType: 'attendance_policy',
          resourceId: policyId,
          description: 'Attendance policy updated',
          metadata: { updatedFields: Object.keys(dto) },
        })
        .catch(() => {});
    return this.policyRepo.findOne({ where: { id: policyId, tenantId } });
  }

  async remove(tenantId: string, policyId: string, actorMemberId?: string) {
    await this.findOne(tenantId, policyId);
    await this.policyRepo.delete(policyId);
    if (actorMemberId)
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'attendance.policy_deleted',
          resourceType: 'attendance_policy',
          resourceId: policyId,
          description: 'Attendance policy deleted',
        })
        .catch(() => {});
  }
}
