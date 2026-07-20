import { ApiProperty } from '@nestjs/swagger';
import { FileUrlMapper } from 'src/common/mappers/file-url.mapper';
import { FileUrlService } from 'src/common/services/file-url.service';
import type { Tenant } from '../entities/tenant.entity';

/** Public careers/branding fields only — no invite codes or internal config. */
export class PublicTenantResponseDto {
  static toResponse(tenant: Tenant, fileUrlService?: FileUrlService): PublicTenantResponseDto {
    const response = new PublicTenantResponseDto();
    response.id = tenant.id;
    response.name = tenant.name;
    response.slug = tenant.slug;
    response.industry = tenant.industry || undefined;
    response.companySize = tenant.companySize || undefined;
    response.location = tenant.location || undefined;

    if (fileUrlService && tenant.logoKey) {
      response.logoUrl =
        FileUrlMapper.mapTenantLogo(tenant.logoKey, {
          tenantId: tenant.id,
          fileUrlService,
        }) || undefined;
    }

    return response;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false })
  logoUrl?: string;

  @ApiProperty({ required: false })
  industry?: string;

  @ApiProperty({ required: false })
  companySize?: string;

  @ApiProperty({ required: false })
  location?: string;
}
