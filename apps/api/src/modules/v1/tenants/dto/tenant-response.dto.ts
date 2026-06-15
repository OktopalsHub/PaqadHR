import { ApiProperty } from '@nestjs/swagger';
import { FileUrlMapper } from 'src/common/mappers/file-url.mapper';
import type { FileUrlService } from 'src/common/services/file-url.service';
import type { Tenant } from '../entities/tenant.entity';

export class TenantResponseDto {
  static toResponse(tenant: Tenant, fileUrlService?: FileUrlService): TenantResponseDto {
    const response = new TenantResponseDto();
    response.id = tenant.id;
    response.name = tenant.name;
    response.slug = tenant.slug;
    response.isActive = tenant.isActive;
    response.inviteCode = tenant.inviteCode;
    response.employeeCode = tenant.employeeCode;
    response.industry = tenant.industry || undefined;
    response.companySize = tenant.companySize || undefined;
    response.location = tenant.location || undefined;
    response.logoKey = tenant.logoKey || undefined;
    response.createdAt = tenant.createdAt
      ? tenant.createdAt.toISOString()
      : new Date().toISOString();
    response.updatedAt = tenant.updatedAt ? tenant.updatedAt.toISOString() : undefined;

    if (fileUrlService && tenant.logoKey) {
      response.logoUrl =
        FileUrlMapper.mapTenantLogo(tenant.logoKey, {
          tenantId: tenant.id,
          fileUrlService,
        }) || undefined;
    }
    return response;
  }

  static toResponseList(tenants: Tenant[], fileUrlService?: FileUrlService): TenantResponseDto[] {
    return tenants.map((tenant) => TenantResponseDto.toResponse(tenant, fileUrlService));
  }

  @ApiProperty({
    description: 'Unique identifier for the tenant',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
  @ApiProperty({
    description: 'Name of the tenant/organization',
    example: 'Acme Corporation',
  })
  name: string;
  @ApiProperty({
    description: 'Unique slug identifier for the tenant',
    example: 'acme-corp',
  })
  slug: string;
  @ApiProperty({
    description: 'Whether the tenant is active',
    example: true,
  })
  isActive: boolean;
  @ApiProperty({
    description: 'Unique invite code for the tenant',
    example: 'INV123ABC',
    required: false,
  })
  inviteCode?: string;
  @ApiProperty({
    description: 'Employee code prefix for the tenant',
    example: 'EMP',
    required: false,
  })
  employeeCode?: string;
  @ApiProperty({
    description: 'Industry sector of the organization',
    example: 'Technology',
    required: false,
  })
  industry?: string;
  @ApiProperty({
    description: 'Size of the company',
    example: '50-200',
    required: false,
  })
  companySize?: string;
  @ApiProperty({
    description: 'Location of the organization',
    example: 'San Francisco, CA',
    required: false,
  })
  location?: string;
  @ApiProperty({
    description: 'Logo storage key',
    required: false,
  })
  logoKey?: string;
  @ApiProperty({
    description: 'Logo URL (constructed from logoKey)',
    example: 'https://custom-domain.com/tenants/123/logo/company-logo_1731668445123.png',
    required: false,
  })
  logoUrl?: string;
  @ApiProperty({
    description: 'Timestamp when the tenant was created',
    example: '2023-12-01T10:00:00Z',
  })
  createdAt: string;
  @ApiProperty({
    description: 'Timestamp when the tenant was last updated',
    example: '2023-12-01T10:00:00Z',
    required: false,
  })
  updatedAt?: string;
}
export class TenantListResponseDto {
  @ApiProperty({
    type: [TenantResponseDto],
    description: 'List of tenants',
  })
  tenants: TenantResponseDto[];
  @ApiProperty({
    description: 'Total number of tenants',
    example: 25,
  })
  total: number;
}
export class TenantCreatedResponseDto extends TenantResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Tenant created successfully',
  })
  message: string;
}
export class TenantMembershipDto {
  @ApiProperty({
    description: 'Member ID',
    example: 'member-uuid-1',
  })
  id: string;
  @ApiProperty({
    description: 'Member role in the tenant',
    example: 'OWNER',
  })
  role: string;
  @ApiProperty({
    description: 'Member join date',
    example: '2024-01-01T00:00:00.000Z',
  })
  joinDate: string;
  @ApiProperty({
    description: 'Whether the member is active',
    example: true,
  })
  isActive: boolean;
}
export class UserTenantResponseDto extends TenantResponseDto {
  @ApiProperty({
    description: 'Membership information for the current user',
    type: TenantMembershipDto,
  })
  membership: TenantMembershipDto;
}
export class UserTenantsResponseDto {
  @ApiProperty({
    type: [UserTenantResponseDto],
    description: 'List of user tenants with membership details',
  })
  tenants: UserTenantResponseDto[];
  @ApiProperty({
    description: 'Total number of tenants',
    example: 2,
  })
  totalCount: number;
}
export class TenantMemberInfoDto {
  @ApiProperty({
    description: 'Member ID',
    example: 'member-uuid-1',
  })
  id: string;
  @ApiProperty({
    description: 'First name',
    example: 'John',
    required: false,
  })
  firstName?: string;
  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    required: false,
  })
  lastName?: string;
  @ApiProperty({
    description: 'Middle name',
    example: 'William',
    required: false,
  })
  middleName?: string;
  @ApiProperty({
    description: 'Preferred name',
    example: 'Johnny',
    required: false,
  })
  preferredName?: string;
  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890',
    required: false,
  })
  phone?: string;
  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-01',
    required: false,
  })
  dateOfBirth?: string;
  @ApiProperty({
    description: 'Gender',
    example: 'MALE',
    required: false,
  })
  gender?: string;
  @ApiProperty({
    description: 'Employee number',
    example: '001',
    required: false,
  })
  employeeNumber?: string;
  @ApiProperty({
    description: 'Member role',
    example: 'OWNER',
  })
  role: string;
  @ApiProperty({
    description: 'Member active status',
    example: true,
  })
  isActive: boolean;
  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://files.domain.com/tenants/123/employees-avatar/avatar_123456.jpg',
    required: false,
  })
  avatarUrl?: string;
  @ApiProperty({
    description: 'Join date',
    example: '2024-01-01T00:00:00.000Z',
  })
  joinDate: string;
  @ApiProperty({
    description: 'Leave date',
    example: '2024-12-31T00:00:00.000Z',
    required: false,
  })
  leaveDate?: string;
}
export class UserTenantWithMembershipDto {
  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
  })
  name: string;
  @ApiProperty({
    description: 'Tenant slug',
    example: 'acme-corp',
  })
  slug: string;
  @ApiProperty({
    description: 'Whether tenant is active',
    example: true,
  })
  isActive: boolean;
  @ApiProperty({
    description: 'Invite code',
    example: 'INV123ABC',
    required: false,
  })
  inviteCode?: string;
  @ApiProperty({
    description: 'Employee code prefix',
    example: 'EMP',
    required: false,
  })
  employeeCode?: string;
  @ApiProperty({
    description: 'Industry sector',
    example: 'Technology',
    required: false,
  })
  industry?: string;
  @ApiProperty({
    description: 'Company size',
    example: '50-200',
    required: false,
  })
  companySize?: string;
  @ApiProperty({
    description: 'Location',
    example: 'San Francisco, CA',
    required: false,
  })
  location?: string;
  @ApiProperty({
    description: 'Logo URL',
    example: 'https://custom-domain.com/tenants/123/logo/company-logo_1731668445123.png',
    required: false,
  })
  logoUrl?: string;
  @ApiProperty({
    description: 'Country code',
    example: 'US',
    required: false,
  })
  countryCode?: string;
  @ApiProperty({
    description: 'Timezone',
    example: 'America/New_York',
  })
  timezone: string;
  @ApiProperty({
    description: 'Preferred currency',
    example: 'USD',
    required: false,
  })
  preferredCurrency?: string;
  @ApiProperty({
    description: 'Member information',
    type: TenantMemberInfoDto,
  })
  member: TenantMemberInfoDto;
}
