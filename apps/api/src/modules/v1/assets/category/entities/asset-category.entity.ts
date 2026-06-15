import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../../common/database/entities/base.entity';
import { TenantMember } from '../../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../../tenants/entities/tenant.entity';
import { Asset } from '../../entities/asset.entity';

@Entity({ name: 'asset_categories' })
export class AssetCategory extends BaseEntity {
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column()
  name: string;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({
    name: 'depreciation_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  depreciationRate?: number;
  @Column({ name: 'maintenance_frequency_months', nullable: true })
  maintenanceFrequencyMonths?: number;
  @Column({ name: 'maintenance_description', nullable: true })
  maintenanceDescription?: string;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @OneToMany(
    () => Asset,
    (asset) => asset.category,
  )
  assets: Asset[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
