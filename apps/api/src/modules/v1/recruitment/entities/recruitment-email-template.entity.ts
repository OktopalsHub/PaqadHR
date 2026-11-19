import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('recruitment_email_template')
@Index('idx_recruitment_email_template_tenant', ['tenantId'])
export class RecruitmentEmailTemplate extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ name: 'body_html', type: 'text' })
  bodyHtml: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_member_id', type: 'uuid', nullable: true })
  createdByMemberId: string | null;
}
