import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { PlanPrice } from './plan-price.entity';

@Entity({ name: 'plans' })
export class Plan extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;
  @Column({ type: 'varchar', length: 100 })
  name: string;
  @Column({ type: 'text', nullable: true })
  description: string | null;
  @Column({ type: 'jsonb', nullable: true, default: {} })
  features: Record<string, boolean>;
  @Column({ type: 'jsonb', nullable: true, default: {} })
  limits: Record<string, number>;
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @OneToMany(
    () => PlanPrice,
    (price) => price.plan,
  )
  prices: PlanPrice[];
}
