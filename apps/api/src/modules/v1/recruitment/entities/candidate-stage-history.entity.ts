import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('recruitment_candidate_stage_history')
@Index('idx_recruitment_stage_history_candidate', ['tenantId', 'candidateId', 'createdAt'])
export class CandidateStageHistory extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId: string;

  @Column({ name: 'from_stage_id', type: 'uuid', nullable: true })
  fromStageId: string | null;

  @Column({ name: 'to_stage_id', type: 'uuid' })
  toStageId: string;

  @Column({ name: 'actor_member_id', type: 'uuid', nullable: true })
  actorMemberId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;
}
