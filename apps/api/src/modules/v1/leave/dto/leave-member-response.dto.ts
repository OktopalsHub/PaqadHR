import { ApiProperty } from '@nestjs/swagger';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
export class LeaveMemberPositionDto {
  @ApiProperty({ description: 'Position ID' })
  id: string;
  @ApiProperty({ description: 'Position title' })
  title: string;
}
export class LeaveMemberDepartmentDto {
  @ApiProperty({ description: 'Department name' })
  name: string;
  @ApiProperty({ description: 'Role in department', required: false })
  role?: string;
}
export class LeaveMemberResponseDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;
  @ApiProperty({ description: 'First name' })
  firstName: string;
  @ApiProperty({ description: 'Last name' })
  lastName: string;
  @ApiProperty({ description: 'Preferred name', required: false })
  preferredName?: string;
  @ApiProperty({ description: 'Employee number', required: false })
  employeeNumber?: string;
  @ApiProperty({
    description: 'Current position',
    type: LeaveMemberPositionDto,
    required: false,
  })
  position?: LeaveMemberPositionDto;
  @ApiProperty({
    description: 'Department information',
    type: LeaveMemberDepartmentDto,
    required: false,
  })
  department?: LeaveMemberDepartmentDto;
}
export class LeaveMemberMapper {
  static toResponse(member: TenantMember): LeaveMemberResponseDto {
    const currentPosition = member.positionHistory?.find((p) => p.isCurrent);
    const activeDepartmentMembership = member.departmentMemberships?.find(
      (dm) => dm.isActive,
    );
    return {
      id: member.id,
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      preferredName: member.preferredName ?? undefined,
      employeeNumber: member.employeeNumber,
      position: currentPosition?.position
        ? {
            id: currentPosition.position.id,
            title: currentPosition.position.title,
          }
        : undefined,
      department: activeDepartmentMembership?.department
        ? {
            name: activeDepartmentMembership.department.name,
            role: activeDepartmentMembership.role,
          }
        : undefined,
    };
  }
}
