export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}
export interface MemberContext {
  id: string;
  role: string;
  memberId: string;
}
export interface RequestContext {
  tenant?: TenantContext;
  member?: MemberContext;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}
