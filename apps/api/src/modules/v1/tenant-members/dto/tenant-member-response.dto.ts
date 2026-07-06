import { ApiProperty } from '@nestjs/swagger';
import { FileUrlMapper } from 'src/common/mappers/file-url.mapper';
import { FileUrlService } from 'src/common/services/file-url.service';
import type { ITenantMemberResponseDto } from '../../../../common/interfaces/itenant-member-response-dto.interface';
import type { TenantMember } from '../entities/tenant-member.entity';

export class TenantMemberUserDto {
  @ApiProperty({ description: 'User ID' })
  id: string;
  @ApiProperty({ description: 'Email address' })
  email: string;
}
export class TenantMemberPositionDto {
  @ApiProperty({ description: 'Position ID' })
  id: string;
  @ApiProperty({ description: 'Position title' })
  title: string;
  @ApiProperty({ description: 'Position color', required: false })
  color?: string;
}
export class TenantMemberDepartmentDto {
  @ApiProperty({ description: 'Department ID' })
  id: string;
  @ApiProperty({ description: 'Department name' })
  name: string;
  @ApiProperty({ description: 'Role in department', required: false })
  role?: string;
  @ApiProperty({ description: 'Department color', required: false })
  color?: string;
}
export class TenantMemberResponseDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;
  @ApiProperty({ description: 'First name' })
  firstName: string;
  @ApiProperty({ description: 'Last name' })
  lastName: string;
  @ApiProperty({ description: 'Middle name', required: false })
  middleName?: string;
  @ApiProperty({ description: 'Preferred name', required: false })
  preferredName?: string;
  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;
  @ApiProperty({ description: 'Date of birth', required: false })
  dateOfBirth?: Date;
  @ApiProperty({ description: 'Gender', required: false })
  gender?: string;
  @ApiProperty({ description: 'Employee number', required: false })
  employeeNumber?: string;
  @ApiProperty({ description: 'Member role' })
  role: string;
  @ApiProperty({ description: 'Whether member is active' })
  isActive: boolean;
  @ApiProperty({ description: 'Avatar storage key', required: false })
  avatarKey?: string;
  @ApiProperty({
    description: 'Avatar URL (constructed from avatarKey)',
    example: 'https://custom-domain.com/tenants/123/employees-avatar/avatar_1731668445123.jpg',
    required: false,
  })
  avatarUrl?: string;
  @ApiProperty({ description: 'Join date' })
  joinDate: Date;
  @ApiProperty({ description: 'Leave date', required: false })
  leaveDate?: Date;
  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;
  @ApiProperty({ description: 'User ID' })
  userId: string;
  @ApiProperty({ description: 'Reports to ID', required: false })
  reportsToId?: string;
  @ApiProperty({ description: 'User information', type: TenantMemberUserDto })
  user: TenantMemberUserDto;
  @ApiProperty({
    description: 'Current position',
    type: TenantMemberPositionDto,
    required: false,
  })
  position?: TenantMemberPositionDto;
  @ApiProperty({
    description: 'Department information',
    type: TenantMemberDepartmentDto,
    required: false,
  })
  department?: TenantMemberDepartmentDto;
}

export class TenantMemberMapper {
  static toResponse(
    member: TenantMember,
    fileUrlService?: FileUrlService,
  ): ITenantMemberResponseDto {
    const currentPosition = member.positionHistory?.find((p) => p.isCurrent);
    const activeDepartmentMembership = member.departmentMemberships?.find((dm) => dm.isActive);
    const currentEmployment = member.employments?.find((e) => e.status === 'active');
    const response: ITenantMemberResponseDto = {
      id: member.id,
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      middleName: member.middleName ?? undefined,
      preferredName: member.preferredName ?? undefined,
      phone: member.phone ?? undefined,
      dateOfBirth: member.dateOfBirth ?? undefined,
      gender: member.gender ?? undefined,
      employeeNumber: member.employeeNumber ?? undefined,
      role: member.role,
      isActive: member.isActive,
      avatarKey: member.avatarKey ?? undefined,
      joinDate: member.joinDate,
      leaveDate: member.leaveDate,
      tenantId: member.tenantId,
      userId: member.userId,
      reportsToId: currentEmployment?.reportsToId,
      user: {
        id: member.user.id,
        email: member.user.email,
      },
      position: currentPosition?.position
        ? {
            id: currentPosition.position.id,
            title: currentPosition.position.title,
            color: currentPosition.position.color,
          }
        : undefined,
      department: activeDepartmentMembership?.department
        ? {
            id: activeDepartmentMembership.department.id,
            name: activeDepartmentMembership.department.name,
            role: activeDepartmentMembership.role,
            color: activeDepartmentMembership.department.color,
          }
        : undefined,
    };
    if (fileUrlService && member.avatarKey && member.tenantId) {
      response.avatarUrl =
        FileUrlMapper.mapMemberAvatar(member.avatarKey, {
          tenantId: member.tenantId,
          fileUrlService,
        }) || undefined;
    }
    return response;
  }
  static toResponseList(
    members: TenantMember[],
    fileUrlService?: FileUrlService,
  ): ITenantMemberResponseDto[] {
    return members.map((member) => TenantMemberMapper.toResponse(member, fileUrlService));
  }
}
