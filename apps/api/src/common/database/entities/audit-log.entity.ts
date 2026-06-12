import { Column, Entity } from 'typeorm';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../enums/audit-action.enum';
import { BaseEntity } from './base.entity';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ name: 'resource_type', type: 'varchar', length: 100, nullable: true })
  resourceType: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 255, nullable: true })
  resourceId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: AuditSeverity.LOW })
  severity: AuditSeverity;

  @Column({ type: 'varchar', length: 20, default: AuditStatus.SUCCESS })
  status: AuditStatus;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
