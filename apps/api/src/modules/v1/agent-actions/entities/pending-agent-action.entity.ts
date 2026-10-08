import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { ApiKey } from '../../api-keys/entities/api-key.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('pending_agent_actions')
@Index(['tenantId', 'status'])
export class PendingAgentAction extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'jsonb', default: {} })
  params: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: 'awaiting_approval' })
  status: string;

  @Column({ name: 'requested_by_member_id', type: 'uuid', nullable: true })
  requestedByMemberId: string | null;

  @ManyToOne(() => TenantMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requested_by_member_id' })
  requestedByMember: TenantMember | null;

  @Column({ name: 'api_key_id', type: 'uuid', nullable: true })
  apiKeyId: string | null;

  @ManyToOne(() => ApiKey, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'api_key_id' })
  apiKey: ApiKey | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128, nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ name: 'approved_by_member_id', type: 'uuid', nullable: true })
  approvedByMemberId: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'api_key' })
  actorType: string;
}
