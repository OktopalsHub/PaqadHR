import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('agent_action_idempotency')
@Index(['tenantId', 'idempotencyKey'], { unique: true })
export class AgentActionIdempotency extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'jsonb' })
  response: Record<string, unknown>;
}
