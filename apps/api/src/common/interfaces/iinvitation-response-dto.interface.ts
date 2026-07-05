import type { InvitationStatus } from 'src/common/enums';

export interface IInvitationResponseDto {
  id: string;
  email: string;
  tenantId: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string;
  jobTitle?: string;
  departmentId?: string;
  employmentType?: string;
  joinDate?: string;
  employeeNumber?: string;
  role: string;
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: Date;
  token: string;
  tenantName: string;
  tenantSlug?: string;
}
