import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('tenant_activities')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'resourceType', 'resourceId'])
@Index(['tenantId', 'action'])
export class TenantActivity extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'actor_member_id', type: 'uuid', nullable: true })
  actorMemberId: string | null;

  @ManyToOne(() => TenantMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_member_id' })
  actorMember: TenantMember | null;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 100, nullable: true })
  resourceType: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 255, nullable: true })
  resourceId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'SUCCESS' })
  status: string;

  @Column({ type: 'varchar', length: 20, default: 'LOW' })
  severity: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'user' })
  actorType: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;
}
