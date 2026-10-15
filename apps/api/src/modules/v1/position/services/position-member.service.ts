import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { Position } from '../entities/position.entity';
import { PositionMember } from '../entities/position-member.entity';
import { PositionMemberRepository } from '../repositories/position-member.repository';

@Injectable()
export class PositionMemberService {
  constructor(
    private readonly positionMemberRepository: PositionMemberRepository,
    @InjectRepository(PositionMember)
    private readonly positionMemberEntityRepository: Repository<PositionMember>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    private readonly activitiesService: ActivitiesService,
    private readonly tenantMembersService: TenantMembersService,
  ) {}
  async assignPosition(
    tenantId: string,
    tenantMemberId: string,
    positionId: string,
    assignedAt: Date = new Date(),
    actorMemberId?: string,
  ): Promise<PositionMember> {
    if (!(await this.tenantMembersService.memberExistsInTenant(tenantId, tenantMemberId))) {
      throw new NotFoundException('Member not found in this workspace');
    }
    const position = await this.positionRepository.findOne({
      where: { id: positionId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!position) {
      throw new NotFoundException('Active position not found in this workspace');
    }
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
    return this.positionMemberRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.member', 'member')
      .innerJoin('assignment.position', 'position')
      .where('assignment.positionId = :positionId', { positionId })
      .andWhere('member.tenantId = :tenantId', { tenantId })
      .andWhere('position.tenantId = :tenantId', { tenantId })
      .getMany();
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
