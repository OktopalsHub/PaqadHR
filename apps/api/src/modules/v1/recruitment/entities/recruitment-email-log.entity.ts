import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

export type RecruitmentEmailStatus = 'sent' | 'failed';

@Entity('recruitment_email_log')
@Index('idx_recruitment_email_log_candidate', ['tenantId', 'candidateId', 'createdAt'])
export class RecruitmentEmailLog extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255 })
  recipientEmail: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 16 })
  status: RecruitmentEmailStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId: string | null;

  @Column({ name: 'sent_by_member_id', type: 'uuid', nullable: true })
  sentByMemberId: string | null;

  @Column({ type: 'varchar', length: 24, default: 'manual' })
  trigger: 'manual' | 'stage';
}
