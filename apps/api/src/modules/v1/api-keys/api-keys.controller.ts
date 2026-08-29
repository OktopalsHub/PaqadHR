import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit, RateLimitPresets } from 'src/common/decorators';import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeysService } from './services/api-keys.service';

@ApiTags('API Keys')
@ApiBearerAuth('JWT-auth')
@Controller('tenants/:tenantId/api-keys')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get('scopes')
  @ApiOperation({ summary: 'List available API key scopes' })
  listScopes() {
    return { scopes: this.apiKeysService.listScopes() };
  }

  @Get()
  @ApiOperation({ summary: 'List active API keys for the workspace' })
  listKeys(@Param('tenantId') tenantId: string) {
    return this.apiKeysService.listKeys(tenantId);
  }

  @Post()
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Create a new API key (secret returned once)' })
  createKey(
    @Param('tenantId') tenantId: string,
    @Req() req: IAuthenticatedMemberRequest,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createKey(
      tenantId,
      req.member.id,
      dto.name,
      dto.scopes,
      dto.expiresAt ? new Date(dto.expiresAt) : null,
    );
  }

  @Delete(':keyId')
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeKey(@Param('tenantId') tenantId: string, @Param('keyId') keyId: string) {
    return this.apiKeysService.revokeKey(tenantId, keyId);
  }
}
