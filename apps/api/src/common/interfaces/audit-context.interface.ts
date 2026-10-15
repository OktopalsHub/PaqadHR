export interface AuditContext {
  tenantId: string;
  performedById: string;
  payrollRunId?: string;
  memberId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}
