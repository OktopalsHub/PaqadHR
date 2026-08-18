import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { PositionMember } from '../entities/position-member.entity';
import { PositionMemberRepository } from '../repositories/position-member.repository';

@Injectable()
export class PositionMemberService {
  constructor(
    private readonly positionMemberRepository: PositionMemberRepository,
    @InjectRepository(PositionMember)
    private readonly positionMemberEntityRepository: Repository<PositionMember>,
    private readonly activitiesService: ActivitiesService,
  ) {}
  async assignPosition(
    tenantId: string,
    tenantMemberId: string,
    positionId: string,
    assignedAt: Date = new Date(),
    actorMemberId?: string,
  ): Promise<PositionMember> {
    const currentAssignment = await this.positionMemberEntityRepository.findOne({
      where: { tenantMemberId, isCurrent: true },
      relations: ['position'],
    });

    if (currentAssignment?.positionId === positionId) {
      throw new BadRequestException('Member already holds this position');
    }

    if (currentAssignment?.assignedAt && assignedAt <= currentAssignment.assignedAt) {
      throw new BadRequestException('Effective date must be after the current position start date');
    }

    const assigned = await this.positionMemberRepository.assignPosition(
      tenantId,
      tenantMemberId,
      positionId,
      assignedAt,
    );

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'position.member_assigned',
          resourceType: 'position_member',
          resourceId: assigned.id,
          description: `Position assigned to member`,
          metadata: { positionId, tenantMemberId },
        })
        .catch(() => {});
    }

    return assigned;
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
  async deletePositionMember(tenantId: string, id: string, actorMemberId?: string): Promise<void> {
    await this.positionMemberRepository.delete(id);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'position.member_removed',
          resourceType: 'position_member',
          resourceId: id,
          description: `Member removed from position`,
        })
        .catch(() => {});
    }
  }
  async restorePositionMember(tenantId: string, id: string): Promise<void> {
    await this.positionMemberRepository.restore(id);
  }
}
