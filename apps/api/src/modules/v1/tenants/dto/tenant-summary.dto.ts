import { ApiProperty } from '@nestjs/swagger';
import { FileUrlMapper } from 'src/common/mappers/file-url.mapper';
import { FileUrlService } from 'src/common/services/file-url.service';
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
