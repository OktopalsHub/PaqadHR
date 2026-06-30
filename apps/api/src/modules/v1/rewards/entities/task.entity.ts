import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('rewards_tasks')
export class Task extends BaseEntity {
  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: 'int' })
  points: number;

  @Column()
  icon: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl?: string;

  @Column({ name: 'submission_type', default: 'instant' })
  submissionType: 'instant' | 'text' | 'file';

  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;
}
