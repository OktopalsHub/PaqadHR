import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '../context/tenant.context';
import { IS_PUBLIC_KEY } from '../decorators';
@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest();
    // Defense-in-depth H-1: auto-enforce for tenant-scoped routes even without explicit decorator
    const hasTenantScope =
      Boolean(request?.params?.tenantId) ||
      Boolean(request?.headers?.['x-tenant-id']) ||
      Boolean(tenantContext.getCurrentTenant()?.id) ||
      Boolean(request?.tenant?.id);
    if (!hasTenantScope) {
      // Non-tenant routes (e.g., POST /tenants, GET /tenants/user/me) — skip membership check
      return true;
    }
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }
    if (!request.tenantMember) {
      throw new ForbiddenException('Tenant membership required');
    }
    return true;
  }
}
