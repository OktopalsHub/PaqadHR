import { User } from '../../users/entities/user.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PayrollRun } from './payroll-run.entity';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { AuditEventType } from "../../../../common/enums/audit-event-type.enum";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity({ name: 'payroll_audit_logs' })
export class PayrollAuditLog extends BaseEntity {
  @ManyToOne(() => PayrollRun, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun | null;
  @Column({ name: 'payroll_run_id', nullable: true })
  payrollRunId: string | null;
  @ManyToOne(() => TenantMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'member_id' })
  member: TenantMember | null;
  @Column({ name: 'member_id', nullable: true })
  memberId: string | null;
  @ManyToOne(() => TenantMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedBy: TenantMember | null;
  @Column({ name: 'performed_by', nullable: true })
  performedById: string | null;
  @Column({
    type: 'enum',
    enum: AuditEventType,
    comment: 'Type of audit event',
  })
  eventType: AuditEventType;
  @Column({
    type: 'varchar',
    length: 200,
    comment: 'Brief description of the event',
  })
  description: string;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Event data before change',
  })
  beforeData: Record<string, any> | null;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Event data after change',
  })
  afterData: Record<string, any> | null;
  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
    comment: 'IP address of the user',
  })
  ipAddress: string | null;
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'User agent string',
  })
  userAgent: string | null;
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Session ID',
  })
  sessionId: string | null;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional metadata',
  })
  metadata: Record<string, any> | null;
}
