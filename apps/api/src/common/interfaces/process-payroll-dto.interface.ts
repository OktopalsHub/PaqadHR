import { AuditEventType } from '../enums/audit-event-type.enum';
import { AuditContext } from './audit-context.interface';

export interface ProcessPayrollDto {
  tenantId: string;
  payrollRunId: string;
  eventType?: AuditEventType;
}

export interface ProcessPayrollWithAudit extends ProcessPayrollDto {
  auditContext: AuditContext;
}
