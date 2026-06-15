import { Column, DeleteDateColumn, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Assessment } from './assessment.entity';

@Entity()
export class CandidateAssessment extends BaseEntity {
  @Column({ name: 'candidate_id' })
  candidateId: string;
  @Column({ name: 'assessment_id' })
  assessmentId: string;
  @Column()
  type: string;
  @Column({ nullable: true })
  score?: number;
  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;
  @Column({ type: 'text', nullable: true })
  feedback?: string;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => Assessment,
    (assessment) => assessment.candidateAssessments,
  )
  assessment: Assessment;
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
