import type { AuditEventType } from '../enums/audit-event-type.enum';

export interface AuditLogEntry {
  eventType: AuditEventType;
  description: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
