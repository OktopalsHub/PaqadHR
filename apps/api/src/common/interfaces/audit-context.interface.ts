export interface AuditContext {
  tenantId: string;
  payrollRunId?: string;
  memberId?: string;
  performedById?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}
