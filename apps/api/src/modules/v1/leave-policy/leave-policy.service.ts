import { Injectable, NotFoundException } from '@nestjs/common';
import type { QueryDeepPartialEntity } from 'typeorm';
import { ActivitiesService } from '../activities/services/activities.service';
import type { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import type { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import type { LeavePolicy } from './entities/leave-policy.entity';
import { LeavePolicyRepository } from './leave-policy.repository';

@Injectable()
export class LeavePolicyService {
  constructor(
    private readonly leavePolicyRepository: LeavePolicyRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}
  async createDefaultPolicy(tenantId: string, actorMemberId?: string) {
    const defaultPolicy = {
      tenantId,
      allowCarryover: false,
      maxCarryoverDays: 0,
      carryoverExpiryMonths: undefined as number | undefined,
      autoCreateAnnualBalances: true,
      prorateForNewJoiners: true,
    };
    const saved = await this.leavePolicyRepository.save(defaultPolicy);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave_policy.created',
          resourceType: 'leave_policy',
          resourceId: saved.id,
          description: `Default leave policy created`,
        })
        .catch(() => {});
    }

    return saved;
  }
  async getTenantPolicy(tenantId: string) {
    return this.leavePolicyRepository.findOne({ where: { tenantId } });
  }
  async updateTenantPolicy(tenantId: string, dto: UpdateLeavePolicyDto, actorMemberId?: string) {
    const policy = await this.getTenantPolicy(tenantId);
    if (!policy) {
      throw new NotFoundException('Tenant leave policy not found');
    }
    const updateData: QueryDeepPartialEntity<LeavePolicy> = { ...dto };
    if ('carryoverExpiryMonths' in dto) {
      updateData.carryoverExpiryMonths = dto.carryoverExpiryMonths ?? null;
    }
    await this.leavePolicyRepository.update(policy.id, updateData);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave_policy.updated',
          resourceType: 'leave_policy',
          resourceId: policy.id,
          description: `Leave policy updated`,
          metadata: { updatedFields: Object.keys(dto) },
        })
        .catch(() => {});
    }

    return this.leavePolicyRepository.findOne({ where: { id: policy.id } });
  }
  async createCustomPolicy(tenantId: string, dto: CreateLeavePolicyDto, actorMemberId?: string) {
    const policyData = {
      tenantId,
      allowCarryover: dto.allowCarryover || false,
      maxCarryoverDays: dto.maxCarryoverDays || 0,
      carryoverExpiryMonths: dto.carryoverExpiryMonths || undefined,
      autoCreateAnnualBalances: dto.autoCreateAnnualBalances ?? true,
      prorateForNewJoiners: dto.prorateForNewJoiners ?? true,
    };
    const saved = await this.leavePolicyRepository.create(policyData);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'leave_policy.created',
          resourceType: 'leave_policy',
          resourceId: saved.id,
          description: `Custom leave policy created`,
        })
        .catch(() => {});
    }

    return saved;
  }
  async getTenantIdsWithCarryoverPolicy(): Promise<string[]> {
    const policies = await this.leavePolicyRepository.find({
      where: { allowCarryover: true },
      select: ['tenantId'],
    });
    return policies.map((policy) => policy.tenantId);
  }
}
