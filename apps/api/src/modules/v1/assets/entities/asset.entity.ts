import { AssetCondition, AssetStatus, AssetType } from 'src/common/enums';
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { AssetAssignment } from '../assignment/entities/asset-assignment.entity';
import { AssetCategory } from '../category/entities/asset-category.entity';
import { AssetDocument } from '../document/entities/asset-document.entity';
import { AssetMaintenance } from '../maintenance/entities/asset-maintenance.entity';

@Entity({ name: 'assets' })
export class Asset extends BaseEntity {
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
  @Column({ type: 'enum', enum: AssetType })
  type: AssetType;
  @Column({ name: 'serial_number', nullable: true })
  serialNumber?: string;
  @Column({ nullable: true })
  model?: string;
  @Column({ nullable: true })
  manufacturer?: string;
  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: Date;
  @Column({ name: 'purchase_price', type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: number;
  @Column({ name: 'warranty_expiry', type: 'date', nullable: true })
  warrantyExpiry?: Date;
  @Column({ type: 'enum', enum: AssetStatus, default: AssetStatus.AVAILABLE })
  status: AssetStatus;
  @Column({ type: 'enum', enum: AssetCondition, default: AssetCondition.NEW })
  condition: AssetCondition;
  @Column({ nullable: true })
  building?: string;
  @Column({ nullable: true })
  floor?: string;
  @Column({ nullable: true })
  room?: string;
  @Column({ name: 'location_notes', nullable: true })
  locationNotes?: string;
  @Column({ nullable: true })
  notes?: string;
  @Column({ name: 'category_id' })
  categoryId: string;
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;
  @ManyToOne(
    () => AssetCategory,
    (category) => category.assets,
  )
  @JoinColumn({ name: 'category_id' })
  category: AssetCategory;
  @ManyToOne(() => TenantMember, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: TenantMember;
  @OneToMany(
    () => AssetAssignment,
    (assignment) => assignment.asset,
  )
  assignments: AssetAssignment[];
  @OneToMany(
    () => AssetMaintenance,
    (maintenance) => maintenance.asset,
  )
  maintenanceHistory: AssetMaintenance[];
  @OneToMany(
    () => AssetDocument,
    (document) => document.asset,
  )
  documents: AssetDocument[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
