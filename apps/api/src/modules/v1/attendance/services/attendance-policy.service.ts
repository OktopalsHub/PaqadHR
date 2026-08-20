import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendancePolicy } from '../entities/attendance-policy.entity';
import type { CreateAttendancePolicyDto } from '../dto/create-attendance-policy.dto';
import type { UpdateAttendancePolicyDto } from '../dto/update-attendance-policy.dto';

/**
 * Handles attendance policy CRUD operations.
 */
@Injectable()
export class AttendancePolicyService {
  private readonly logger = new Logger(AttendancePolicyService.name);

  constructor(
    @InjectRepository(AttendancePolicy)
    private readonly policyRepository: Repository<AttendancePolicy>,
  ) { }

  async createAttendancePolicy(
    dto: CreateAttendancePolicyDto,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<AttendancePolicy> {
    try {
      // Check if policy with same name already exists
      const existingPolicy = await this.policyRepository.findOne({
        where: { tenantId, name: dto.name },
      });

      if (existingPolicy) {
        throw new BadRequestException('An attendance policy with this name already exists');
      }

      const policyData = {
        ...dto,
        tenantId,
        createdById: actorMemberId,
      };

      const policy = this.policyRepository.create(policyData);
      return await this.policyRepository.save(policy);
    } catch (error) {
      this.logger.error(`Failed to create attendance policy for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getAttendancePolicies(tenantId: string): Promise<AttendancePolicy[]> {
    return await this.policyRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAttendancePolicy(tenantId: string, policyId: string): Promise<AttendancePolicy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId },
    });

    if (!policy) {
      throw new NotFoundException('Attendance policy not found');
    }

    return policy;
  }

  async updateAttendancePolicy(
    tenantId: string,
    policyId: string,
    dto: UpdateAttendancePolicyDto,
    actorMemberId?: string,
  ): Promise<AttendancePolicy> {
    const policy = await this.getAttendancePolicy(tenantId, policyId);

    // Check if new name conflicts with another policy
    if (dto.name && dto.name !== policy.name) {
      const existingPolicy = await this.policyRepository.findOne({
        where: { tenantId, name: dto.name },
      });

      if (existingPolicy && existingPolicy.id !== policyId) {
        throw new BadRequestException('An attendance policy with this name already exists');
      }
    }

    // Update policy
    Object.assign(policy, dto);
    policy.updatedById = actorMemberId;

    return await this.policyRepository.save(policy);
  }

  async deleteAttendancePolicy(
    tenantId: string,
    policyId: string,
    actorMemberId?: string,
  ): Promise<void> {
    const policy = await this.getAttendancePolicy(tenantId, policyId);

    // Check if policy is in use (you might need additional logic here)
    // const usageCheck = await this.checkPolicyUsage(tenantId, policyId);
    // if (usageCheck.inUse) {
    //   throw new BadRequestException('Cannot delete policy that is in use');
    // }

    policy.deletedAt = new Date();
    policy.deletedById = actorMemberId;

    await this.policyRepository.save(policy);
  }

  async isClockInEnabled(tenantId: string): Promise<boolean> {
    const policies = await this.getAttendancePolicies(tenantId);
    return policies.some(policy => policy.isActive && policy.enableClockIn);
  }

  async getSessionLimit(tenantId: string): Promise<number> {
    const policies = await this.getAttendancePolicies(tenantId);
    const activePolicy = policies.find(policy => policy.isActive);
    return activePolicy?.sessionLimit || 8; // Default to 8 hours
  }
}
