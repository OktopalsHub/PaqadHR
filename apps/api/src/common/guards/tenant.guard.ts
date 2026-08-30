import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '../context/tenant.context';
import {
  AUTH_ONLY_KEY,
  IS_MEMBER_OPTIONAL_KEY,
  IS_PUBLIC_KEY,
  REQUIRE_TENANT_KEY,
} from '../decorators';
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
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
    // Defense-in-depth: auto-require tenant for any tenant-scoped route (BOLA prevention H-1)
    // If route contains :tenantId or x-tenant-id header or tenant context, enforce isolation even without @RequireTenant
    const requestEarly = context.switchToHttp().getRequest();
    const hasTenantScope =
      Boolean(requestEarly?.params?.tenantId) ||
      Boolean(requestEarly?.headers?.['x-tenant-id']) ||
      Boolean(tenantContext.getCurrentTenant()?.id);
    const requireTenant = explicitRequireTenant ?? hasTenantScope;
    if (!requireTenant) {
      return true;
    }
    const tenant = tenantContext.getCurrentTenant();
    if (tenant?.isActive) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const requestTenant = request.tenant;
    if (requestTenant) {
      if (!requestTenant.isActive) {
        throw new ForbiddenException('Tenant is not active');
      }
      return true;
    }
    // Defer to controller-level TenantMemberGuard when scope comes from route/header only
    if (hasTenantScope && !explicitRequireTenant) {
      return true;
    }
    throw new ForbiddenException('Tenant context is required');
  }
}
