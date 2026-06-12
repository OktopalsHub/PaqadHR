import { Column, DeleteDateColumn, Entity } from 'typeorm';
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity()
export class CandidateNote extends BaseEntity {
  @Column({ name: 'candidate_id' })
  candidateId: string;
  @Column({ name: 'user_id' })
  userId: string;
  @Column({ type: 'text' })
  content: string;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
