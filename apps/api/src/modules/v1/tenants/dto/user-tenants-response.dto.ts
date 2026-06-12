export class UserTenantResponseDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  industry?: string;
  companySize?: string;
  location?: string;
  inviteCode: string;
  employeeCode: string;
  createdAt: Date;
  updatedAt: Date;
}
export class UserTenantsResponseDto {
  tenants: UserTenantResponseDto[];
  totalCount: number;
}
