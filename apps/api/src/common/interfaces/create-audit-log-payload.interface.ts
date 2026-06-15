import type { AuditAction, AuditSeverity, AuditStatus } from '../enums/audit-action.enum';

export interface CreateAuditLogPayload {
  action: AuditAction;
  description: string;
  severity: AuditSeverity;
  status: AuditStatus;
  resourceType?: string | null;
  resourceId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}
