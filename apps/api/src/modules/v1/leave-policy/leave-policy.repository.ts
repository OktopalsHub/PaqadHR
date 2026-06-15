import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeavePolicy } from './entities/leave-policy.entity';

@Injectable()
export class LeavePolicyRepository extends Repository<LeavePolicy> {
  constructor(
    @InjectRepository(LeavePolicy)
    private readonly leavePolicyRepository: Repository<LeavePolicy>,
  ) {
    super(
      leavePolicyRepository.target,
      leavePolicyRepository.manager,
      leavePolicyRepository.queryRunner,
    );
  }
  async findByTenantId(tenantId: string): Promise<LeavePolicy | null> {
    return this.leavePolicyRepository.findOne({
      where: { tenantId },
    });
  }
  async getTenantsWithCarryoverPolicy(): Promise<string[]> {
    const policies = await this.leavePolicyRepository.find({
      where: { allowCarryover: true },
      select: ['tenantId'],
    });
    return policies.map((policy) => policy.tenantId);
  }
}
