import { AssetAssignmentStatus } from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne } from 'typeorm';
import { Asset } from "../../entities/asset.entity";
import { TenantMember } from "../../../tenant-members/entities/tenant-member.entity";
import { BaseEntity } from "../../../../../common/database/entities/base.entity";

@Entity({ name: 'asset_assignments' })
export class AssetAssignment extends BaseEntity {
  @Column({
    name: 'assigned_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  assignedDate: Date;
  @Column({ name: 'return_date', type: 'timestamp', nullable: true })
  returnDate?: Date;
  @Column({ name: 'expected_return_date', type: 'timestamp', nullable: true })
  expectedReturnDate?: Date;
  @Column({
    type: 'enum',
    enum: AssetAssignmentStatus,
    default: AssetAssignmentStatus.ACTIVE,
  })
  status: AssetAssignmentStatus;
  @Column({ name: 'assignment_notes', nullable: true })
  assignmentNotes?: string;
  @Column({ name: 'return_notes', nullable: true })
  returnNotes?: string;
  @Column({ name: 'return_condition', nullable: true })
  returnCondition?: string;
  @Column({ name: 'asset_id' })
  assetId: string;
  @ManyToOne(() => Asset, (asset) => asset.assignments)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;
  @Column({ name: 'assigned_to_id' })
  assignedToId: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: TenantMember;
  @Column({ name: 'assigned_by_id' })
  assignedById: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy: TenantMember;
  @Column({ name: 'returned_by_id', nullable: true })
  returnedById?: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'returned_by_id' })
  returnedBy?: TenantMember;
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
