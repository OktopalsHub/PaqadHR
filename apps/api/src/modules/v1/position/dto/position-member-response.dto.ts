import { ApiProperty } from '@nestjs/swagger';

import type { PositionMember } from '../entities/position-member.entity';

export class PositionAssignmentPositionDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty({ required: false })
  department?: string;
  @ApiProperty({ required: false })
  description?: string;
  @ApiProperty()
  isActive: boolean;
  @ApiProperty({ required: false })
  color?: string;
}
export class PositionAssignmentMemberDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  firstName: string;
  @ApiProperty()
  lastName: string;
}
export class PositionHistoryEntryDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  tenantMemberId: string;
  @ApiProperty()
  positionId: string;
  @ApiProperty()
  assignedAt: Date;
  @ApiProperty()
  isCurrent: boolean;
  @ApiProperty({ required: false, type: PositionAssignmentPositionDto })
  position?: PositionAssignmentPositionDto;
}
export class PositionRosterEntryDto extends PositionHistoryEntryDto {
  @ApiProperty({ required: false, type: PositionAssignmentMemberDto })
  member?: PositionAssignmentMemberDto;
}

export class PositionMemberMapper {
  static toHistoryEntry(assignment: PositionMember): PositionHistoryEntryDto {
    return {
      id: assignment.id,
      tenantMemberId: assignment.tenantMemberId,
      positionId: assignment.positionId,
      assignedAt: assignment.assignedAt,
      isCurrent: assignment.isCurrent,
      position: assignment.position
        ? {
            id: assignment.position.id,
            title: assignment.position.title,
            department: assignment.position.department,
            description: assignment.position.description,
            isActive: assignment.position.isActive,
            color: assignment.position.color,
          }
        : undefined,
    };
  }
  static toHistoryList(assignments: PositionMember[]): PositionHistoryEntryDto[] {
    return assignments.map((assignment) => PositionMemberMapper.toHistoryEntry(assignment));
  }
  static toRosterEntry(assignment: PositionMember): PositionRosterEntryDto {
    return {
      ...PositionMemberMapper.toHistoryEntry(assignment),
      member: assignment.member
        ? {
            id: assignment.member.id,
            firstName: assignment.member.firstName ?? '',
            lastName: assignment.member.lastName ?? '',
          }
        : undefined,
    };
  }
  static toRosterList(assignments: PositionMember[]): PositionRosterEntryDto[] {
    return assignments.map((assignment) => PositionMemberMapper.toRosterEntry(assignment));
  }
}
