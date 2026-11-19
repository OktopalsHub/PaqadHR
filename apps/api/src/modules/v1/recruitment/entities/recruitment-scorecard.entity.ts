import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

export type ScorecardRecommendation = 'STRONG_YES' | 'YES' | 'NO' | 'STRONG_NO';

@Entity('recruitment_scorecard')
@Unique('uq_recruitment_scorecard_reviewer', ['candidateId', 'reviewerMemberId'])
@Index('idx_recruitment_scorecard_candidate', ['tenantId', 'candidateId'])
export class RecruitmentScorecard extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId: string;

  @Column({ name: 'reviewer_member_id', type: 'uuid' })
  reviewerMemberId: string;

  /** Attribute name to a 1-4 rating. */
  @Column({ type: 'jsonb' })
  ratings: Record<string, number>;

  @Column({ type: 'varchar', length: 16 })
  recommendation: ScorecardRecommendation;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
