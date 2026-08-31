import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { tenantContext } from 'src/common/context/tenant.context';
import type { TenantMemberRole } from 'src/common/enums';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { Repository } from 'typeorm';
import { firstRouteParam } from '../../../../common/utils/route-param.util';
import { resolveTenantIdFromRequest } from '../../../../common/utils/tenant-request.util';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantMembersService } from '../tenant-members.service';

@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(
    private readonly tenantMemberService: TenantMembersService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    readonly _reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IAuthenticatedMemberRequest>();

    const tenantId =
      firstRouteParam(request.params.tenantId) ?? resolveTenantIdFromRequest(request);

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found');
    }

    const userId = request.auth?.principalId;
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const member = await this.tenantMemberService.checkUserTenantMembership(userId, tenantId);
    if (!member) {
      throw new ForbiddenException('You are not a member of this tenant');
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
      tenant: {
        id: tenantId,
        slug: tenant.slug,
        name: tenant.name,
        isActive: tenant.isActive,
      },
      member: {
        id: member.id,
        role: member.role as TenantMemberRole,
        memberId: member.id,
      },
    });

    return true;
  }
}
