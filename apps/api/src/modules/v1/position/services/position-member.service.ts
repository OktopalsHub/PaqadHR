import { Injectable } from '@nestjs/common';
import { PositionMemberRepository } from "../repositories/position-member.repository";
import { PositionMember } from "../entities/position-member.entity";

@Injectable()
export class PositionMemberService {
  constructor(
    private readonly positionMemberRepository: PositionMemberRepository,
  ) {}
  assignPosition(
    tenantId: string,
    tenantMemberId: string,
    positionId: string,
    assignedAt: Date = new Date(),
  ): Promise<PositionMember> {
    return this.positionMemberRepository.assignPosition(
      tenantId,
      tenantMemberId,
      positionId,
      assignedAt,
    );
  }
  getPositionHistory(
    tenantId: string,
    tenantMemberId: string,
  ): Promise<PositionMember[]> {
    return this.positionMemberRepository.getPositionHistory(
      tenantId,
      tenantMemberId,
    );
  }
  async getMembersByPosition(
    tenantId: string,
    positionId: string,
  ): Promise<PositionMember[]> {
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
