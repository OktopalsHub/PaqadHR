export interface CreateActivityPayload {
  tenantId: string;
  actorMemberId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  description: string;
  status?: string;
  severity?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}
