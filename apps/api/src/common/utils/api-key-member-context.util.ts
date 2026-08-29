import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { tenantContext } from 'src/common/context/tenant.context';
import type { TenantMemberRole } from 'src/common/enums';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import type { Repository } from 'typeorm';
import type { Tenant } from '../../modules/v1/tenants/entities/tenant.entity';
import type { TenantMembersService } from '../../modules/v1/tenant-members/tenant-members.service';

export async function resolveApiKeyMemberContext(
  request: IAuthenticatedMemberRequest,
  tenantId: string,
  tenantMemberService: TenantMembersService,
  tenantRepository: Repository<Tenant>,
): Promise<void> {
  if (request.auth.authType !== 'api_key') {
    throw new ForbiddenException('API key authentication required');
  }

  if (request.auth.tenantId !== tenantId) {
    throw new ForbiddenException('API key is not valid for this tenant');
  }

  const tenant = await tenantRepository.findOne({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundException('Tenant not found');
  }

  const memberId = request.auth.memberId;
  if (!memberId) {
    throw new ForbiddenException('API key member context missing');
  }

  const userId = request.auth.principalId;
  const member = await tenantMemberService.checkUserTenantMembership(userId, tenantId);
  if (!member || member.id !== memberId) {
    throw new ForbiddenException('API key member is not valid for this tenant');
  }

  request.member = {
    id: member.id,
    role: member.role as TenantMemberRole,
    memberId: member.id,
  };
  request.tenant = {
    id: tenantId,
    slug: tenant.slug,
    name: tenant.name,
    isActive: tenant.isActive,
  };
  tenantContext.updateContext({
    tenant: request.tenant,
    member: {
      id: member.id,
      role: member.role as TenantMemberRole,
      memberId: member.id,
    },
  });
}
