export interface AuditContext {
  payrollRunId?: string;
  memberId?: string;
  performedById?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}
