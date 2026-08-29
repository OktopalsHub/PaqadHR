import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('api_keys')
@Index(['tenantId', 'keyPrefix'])
export class ApiKey extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'created_by_member_id', type: 'uuid' })
  createdByMemberId: string;

  @ManyToOne(() => TenantMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_member_id' })
  createdByMember: TenantMember;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix: string;

  @Column({ name: 'key_hash', type: 'text' })
  keyHash: string;

  @Column({ type: 'jsonb', default: [] })
  scopes: string[];

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
