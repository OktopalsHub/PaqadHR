import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from '../entities/assessment.entity';

@Injectable()
export class AssessmentRepository extends Repository<Assessment> {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepository: Repository<Assessment>,
  ) {
    super(
      assessmentRepository.target,
      assessmentRepository.manager,
      assessmentRepository.queryRunner,
    );
  }
  async findByTenantMemberAndId(
    tenantId: string,
    tenantMemberId: string,
    assessmentId: string,
    includeDeleted: boolean = false,
    relations: string[] = [],
  ): Promise<Assessment> {
    const assessment = await this.assessmentRepository.findOne({
      where: {
        id: assessmentId,
        tenantMemberId,
        tenantId,
      },
      withDeleted: includeDeleted,
      relations,
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found for this member');
    }
    return assessment;
  }
  async findAllByTenantMember(
    tenantId: string,
    tenantMemberId: string,
    includeDeleted: boolean = false,
    relations: string[] = [],
  ): Promise<Assessment[]> {
    return this.assessmentRepository.find({
      where: {
        tenantMemberId,
        tenantId,
      },
      withDeleted: includeDeleted,
      relations,
    });
  }
  async findActiveByTenantMember(
    tenantId: string,
    tenantMemberId: string,
    includeDeleted: boolean = false,
    relations: string[] = [],
  ): Promise<Assessment[]> {
    return this.assessmentRepository.find({
      where: {
        tenantMemberId,
        tenantId,
        isActive: true,
      },
      withDeleted: includeDeleted,
      relations,
    });
  }
}
