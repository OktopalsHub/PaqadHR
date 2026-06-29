import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return false;
    const request = context.switchToHttp().getRequest<IAuthenticatedMemberRequest>();
    const tenantMember = request.member;
    if (!tenantMember) {
      return false;
    }
    return requiredRoles.some((role) => tenantMember.role === role);
  }
}
