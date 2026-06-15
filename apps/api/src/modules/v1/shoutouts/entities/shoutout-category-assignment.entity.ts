import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Shoutout } from './shoutout.entity';
import { ShoutoutCategory } from './shoutout-category.entity';

@Entity('shoutout_category_assignments')
export class ShoutoutCategoryAssignment extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'shoutout_id', type: 'uuid' })
  shoutoutId: string;

  @ManyToOne(
    () => Shoutout,
    (shoutout) => shoutout.categoryAssignments,
  )
  @JoinColumn({ name: 'shoutout_id' })
  shoutout: Shoutout;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ShoutoutCategory)
  @JoinColumn({ name: 'category_id' })
  category: ShoutoutCategory;
}
