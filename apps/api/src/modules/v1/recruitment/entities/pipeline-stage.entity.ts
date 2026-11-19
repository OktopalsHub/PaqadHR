import { CandidateStatus } from 'src/common/enums';
import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('recruitment_pipeline_stage')
@Index('idx_recruitment_pipeline_stage_scope', ['tenantId', 'jobOpeningId', 'position'])
export class PipelineStage extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** Null means the workspace default pipeline; a job id overrides it for that job. */
  @Column({ name: 'job_opening_id', type: 'uuid', nullable: true })
  jobOpeningId: string | null;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'int' })
  position: number;

  /** The coarse status this stage maps to, so analytics and existing views keep working. */
  @Column({ type: 'varchar', length: 16 })
  type: CandidateStatus;

  @Column({ name: 'auto_email_template_id', type: 'uuid', nullable: true })
  autoEmailTemplateId: string | null;
}
