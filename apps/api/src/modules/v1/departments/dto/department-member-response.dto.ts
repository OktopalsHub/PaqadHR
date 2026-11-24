import { ApiProperty } from '@nestjs/swagger';

import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

export class DepartmentMemberSummaryDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  firstName: string;
  @ApiProperty()
  lastName: string;
  @ApiProperty({ required: false })
  preferredName?: string;
  @ApiProperty()
  role: string;
  @ApiProperty()
  isActive: boolean;
  @ApiProperty({ required: false })
  avatarKey?: string;
}

export class DepartmentMemberSummaryMapper {
  static toResponse(member: TenantMember): DepartmentMemberSummaryDto {
    return {
      id: member.id,
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      preferredName: member.preferredName ?? undefined,
      role: member.role,
      isActive: member.isActive,
      avatarKey: member.avatarKey ?? undefined,
    };
  }
  static toResponseList(members: TenantMember[]): DepartmentMemberSummaryDto[] {
    return members.map((member) => DepartmentMemberSummaryMapper.toResponse(member));
  }
}
