import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PositionMember } from '../entities/position-member.entity';
import { PositionMemberRepository } from '../repositories/position-member.repository';

@Injectable()
export class PositionMemberService {
  constructor(
    private readonly positionMemberRepository: PositionMemberRepository,
    @InjectRepository(PositionMember)
    private readonly positionMemberEntityRepository: Repository<PositionMember>,
  ) {}
  async assignPosition(
    tenantId: string,
    tenantMemberId: string,
    positionId: string,
    assignedAt: Date = new Date(),
  ): Promise<PositionMember> {
    const currentAssignment = await this.positionMemberEntityRepository.findOne({
      where: { tenantMemberId, isCurrent: true },
      relations: ['position'],
    });

    if (currentAssignment?.positionId === positionId) {
      throw new BadRequestException('Member already holds this position');
    }

    if (currentAssignment?.assignedAt && assignedAt <= currentAssignment.assignedAt) {
      throw new BadRequestException(
        'Effective date must be after the current position start date',
      );
    }

    return this.positionMemberRepository.assignPosition(
      tenantId,
      tenantMemberId,
      positionId,
      assignedAt,
    );
  }
  getPositionHistory(tenantId: string, tenantMemberId: string): Promise<PositionMember[]> {
    return this.positionMemberRepository.getPositionHistory(tenantId, tenantMemberId);
  }
  async getMembersByPosition(tenantId: string, positionId: string): Promise<PositionMember[]> {
    return this.positionMemberRepository.find({
      where: { positionId },
      relations: ['tenantMember'],
    });
  }
  async deletePositionMember(tenantId: string, id: string): Promise<void> {
    await this.positionMemberRepository.delete(id);
  }
  async restorePositionMember(tenantId: string, id: string): Promise<void> {
    await this.positionMemberRepository.restore(id);
  }
}
