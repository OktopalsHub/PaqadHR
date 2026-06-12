import {
  Column,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany } from 'typeorm';
import { CandidateAssessment } from './candidate-assessment.entity';
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity()
export class Assessment extends BaseEntity {
  @Column()
  type: string;
  @Column()
  title: string;
  @Column({ type: 'text' })
  description: string;
  @Column({ type: 'json' })
  questions: {
    question: string;
    type: string;
    options?: string[];
    correctAnswer?: string;
  }[];
  @Column()
  duration: number; 
  @Column({ name: 'passing_score' })
  passingScore: number;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @OneToMany(
    () => CandidateAssessment,
    (candidateAssessment) => candidateAssessment.assessment,
  )
  candidateAssessments: CandidateAssessment[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
