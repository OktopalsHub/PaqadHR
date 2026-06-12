import { MaintenanceStatus, MaintenanceType } from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne } from 'typeorm';
import { Asset } from "../../entities/asset.entity";
import { TenantMember } from "../../../tenant-members/entities/tenant-member.entity";
import { BaseEntity } from "../../../../../common/database/entities/base.entity";

@Entity({ name: 'asset_maintenance' })
export class AssetMaintenance extends BaseEntity {
  @Column({ name: 'maintenance_date', type: 'date' })
  maintenanceDate: Date;
  @Column({ type: 'enum', enum: MaintenanceType })
  type: MaintenanceType;
  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;
  @Column({ type: 'text' })
  description: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost?: number;
  @Column({ name: 'performed_by', nullable: true })
  performedBy?: string;
  @Column({ name: 'next_maintenance_date', type: 'date', nullable: true })
  nextMaintenanceDate?: Date;
  @Column({ name: 'completion_date', type: 'timestamp', nullable: true })
  completionDate?: Date;
  @Column({ nullable: true })
  notes?: string;
  @Column({ name: 'asset_id' })
  assetId: string;
  @ManyToOne(() => Asset, (asset) => asset.maintenanceHistory)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;
  @Column({ name: 'scheduled_by_id' })
  scheduledById: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'scheduled_by_id' })
  scheduledBy: TenantMember;
  @Column({ name: 'completed_by_id', nullable: true })
  completedById?: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'completed_by_id' })
  completedBy?: TenantMember;
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
