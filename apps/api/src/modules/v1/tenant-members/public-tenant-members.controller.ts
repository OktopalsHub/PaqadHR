import { Tenant } from '../tenants/entities/tenant.entity';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantMemberRole } from 'src/common/enums';
import { Public } from '../../../common/decorators';
@ApiTags('Public Tenant Members')
@Controller('tenant-members')
export class PublicTenantMembersController {
  @Get('roles')
  @Public()
  getTenantMemberRoles() {
    const roles = Object.values(TenantMemberRole).filter(
      (role) => role !== TenantMemberRole.OWNER,
    );
    return roles.map((role) => ({
      value: role,
      label: role.charAt(0).toUpperCase() + role.slice(1),
    }));
  }
}
