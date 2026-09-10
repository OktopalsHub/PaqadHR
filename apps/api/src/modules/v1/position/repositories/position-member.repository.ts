import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PositionMember } from '../entities/position-member.entity';

@Injectable()
export class PositionMemberRepository extends Repository<PositionMember> {
  constructor(
    @InjectRepository(PositionMember)
    private readonly positionMemberRepository: Repository<PositionMember>,
  ) {
    super(
      positionMemberRepository.target,
      positionMemberRepository.manager,
      positionMemberRepository.queryRunner,
    );
  }

  async findAll(where?: Record<string, unknown>): Promise<PositionMember[]> {
    return this.find({ where });
  }

  async assignPosition(
    tenantId: string,
    tenantMemberId: string,
    positionId: string,
    assignedAt: Date = new Date(),
  ): Promise<PositionMember> {
    await this.positionMemberRepository.update(
      { tenantMemberId, isCurrent: true },
      { isCurrent: false },
    );
    const assignment = this.positionMemberRepository.create({
      tenantMemberId,
      positionId,
      assignedAt,
      isCurrent: true,
    });
    return this.positionMemberRepository.save(assignment);
  }
  async getPositionHistory(tenantId: string, tenantMemberId: string): Promise<PositionMember[]> {
    return this.positionMemberRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.member', 'member')
      .innerJoinAndSelect('assignment.position', 'position')
      .where('assignment.tenantMemberId = :tenantMemberId', { tenantMemberId })
      .andWhere('member.tenantId = :tenantId', { tenantId })
      .andWhere('position.tenantId = :tenantId', { tenantId })
      .orderBy('assignment.assignedAt', 'DESC')
      .getMany();
  }
}
