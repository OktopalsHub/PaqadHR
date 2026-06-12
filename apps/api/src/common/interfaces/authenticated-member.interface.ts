import { TenantMemberRole } from '../enums';
import { IAuthenticatedUserRequest } from './authenticated-user.interface';
export interface IAuthenticatedMemberRequest extends IAuthenticatedUserRequest {
  member: { id: string; role: TenantMemberRole; userId?: string };
  tenant?: { id: string; slug: string; name: string; isActive: boolean };
}
