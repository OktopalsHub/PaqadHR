import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import type { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';
import { LeavePolicyRepository } from './leave-policy.repository';

@Injectable()
export class LeavePolicyService {
  constructor(private readonly leavePolicyRepository: LeavePolicyRepository) {}
  async createDefaultPolicy(tenantId: string) {
    const defaultPolicy = {
      tenantId,
      allowCarryover: false,
      maxCarryoverDays: 0,
      carryoverExpiryMonths: undefined as number | undefined,
      autoCreateAnnualBalances: true,
      prorateForNewJoiners: true,
    };
    return this.leavePolicyRepository.save(defaultPolicy);
  }
  async getTenantPolicy(tenantId: string) {
    return this.leavePolicyRepository.findOne({ where: { tenantId } });
  }
  async updateTenantPolicy(tenantId: string, dto: UpdateLeavePolicyDto) {
    const policy = await this.getTenantPolicy(tenantId);
    if (!policy) {
      throw new NotFoundException('Tenant leave policy not found');
    }
    const updateData: Partial<typeof policy> = {
      ...dto,
      carryoverExpiryMonths: dto.carryoverExpiryMonths || undefined,
    };
    return this.leavePolicyRepository.update(
      policy.id,
      updateData as Parameters<typeof this.leavePolicyRepository.update>[1],
    );
  }
  async createCustomPolicy(tenantId: string, dto: CreateLeavePolicyDto) {
    const policyData = {
      tenantId,
      allowCarryover: dto.allowCarryover || false,
      maxCarryoverDays: dto.maxCarryoverDays || 0,
      carryoverExpiryMonths: dto.carryoverExpiryMonths || undefined,
      autoCreateAnnualBalances: dto.autoCreateAnnualBalances ?? true,
      prorateForNewJoiners: dto.prorateForNewJoiners ?? true,
    };
    return this.leavePolicyRepository.create(policyData);
  }
  async getTenantIdsWithCarryoverPolicy(): Promise<string[]> {
    const policies = await this.leavePolicyRepository.find({
      where: { allowCarryover: true },
      select: ['tenantId'],
    });
    return policies.map((policy) => policy.tenantId);
  }
}
