import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantMemberPermission, TenantMemberRole } from 'src/common/enums';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';

/** Allows workspace admins and owner-approved people managers to change org assignments. */
@Injectable()
export class ManageEmployeeOrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IAuthenticatedMemberRequest>();
    const member = request.member;
    const allowed =
      member?.role === TenantMemberRole.OWNER ||
      member?.role === TenantMemberRole.ADMIN ||
      member?.permissions?.includes(TenantMemberPermission.MANAGE_EMPLOYEE_ORGANIZATION);

    if (!allowed) {
      throw new ForbiddenException('Employee organization management access is required');
    }
    return true;
  }
}
