import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantMemberRepository } from '../../modules/v1/tenant-members/repositories/tenant-members.repository';
import { tenantContext } from '../context/tenant.context';
import {
  AUTH_ONLY_KEY,
  IS_MEMBER_OPTIONAL_KEY,
  IS_PUBLIC_KEY,
  REQUIRE_TENANT_KEY,
} from '../decorators';
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly tenantMemberRepository: TenantMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const isAuthOnly = this.reflector.getAllAndOverride<boolean>(AUTH_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAuthOnly) {
      const request = context.switchToHttp().getRequest();
      if (!request.user) {
        throw new ForbiddenException('Authentication required');
      }
      return true;
    }
    const _isMemberOptional = this.reflector.getAllAndOverride<boolean>(IS_MEMBER_OPTIONAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const explicitRequireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const requestedTenantId =
      request?.params?.tenantId ??
      request?.headers?.['x-tenant-id'] ??
      tenantContext.getCurrentTenantId();
    const requireTenant = explicitRequireTenant ?? Boolean(requestedTenantId);
    if (!requireTenant) return true;

    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }
    if (!requestedTenantId || typeof requestedTenantId !== 'string') {
      throw new ForbiddenException('Tenant context is required');
    }

    const contextTenantId = tenantContext.getCurrentTenantId();
    if (contextTenantId && contextTenantId !== requestedTenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    const membership = await this.tenantMemberRepository.findMembershipByUserAndTenant(
      request.user.principalId,
      requestedTenantId,
    );
    if (!membership || !membership.isActive) {
      throw new ForbiddenException('Tenant access denied');
    }

    const tenantMembership = await this.tenantMemberRepository.findOne({
      where: { id: membership.id, tenantId: requestedTenantId },
      relations: ['tenant'],
    });
    if (!tenantMembership?.tenant?.isActive) {
      throw new ForbiddenException('Tenant is not active');
    }

    return true;
  }
}
