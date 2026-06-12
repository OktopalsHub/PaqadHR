import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantMemberRole } from 'src/common/enums';
import { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { Repository } from 'typeorm';
import { firstRouteParam } from '../../../../common/utils/route-param.util';
import { tenantContext } from 'src/common/context/tenant.context';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantMembersService } from '../tenant-members.service';

@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(
    private readonly tenantMemberService: TenantMembersService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context
        .switchToHttp()
        .getRequest<IAuthenticatedMemberRequest>();
      const tenantId = firstRouteParam(request.params.tenantId);
      const userId = request.auth.principalId;
      if (!tenantId) {
        throw new ForbiddenException('Tenant ID not found');
      }
      const tenant = await this.tenantRepository.findOne({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      const member = await this.tenantMemberService.checkUserTenantMembership(
        userId,
        tenantId,
      );
      if (!member) {
        throw new ForbiddenException('You are not a member of this Tenant');
      }
      request.member = {
        id: member.id,
        role: member.role as TenantMemberRole,
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
          userId: member.userId,
        },
      });
      return true;
    } catch (error) {
      throw error;
    }
  }
}
