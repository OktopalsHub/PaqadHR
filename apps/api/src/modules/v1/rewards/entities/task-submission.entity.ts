import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('rewards_task_submissions')
export class TaskSubmission extends BaseEntity {
  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'member_id' })
  memberId: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'completed' | 'rejected';

  @Column({ name: 'submission_text', nullable: true })
  submissionText?: string;

  @Column({ name: 'submission_file_name', nullable: true })
  submissionFileName?: string;
}
