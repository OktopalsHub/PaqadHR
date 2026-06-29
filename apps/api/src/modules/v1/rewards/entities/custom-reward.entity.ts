import { Column, DeleteDateColumn, Entity } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('custom_rewards')
export class CustomReward extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'points_cost', type: 'int' })
  pointsCost: number;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'stock_limit', type: 'int', nullable: true })
  stockLimit: number | null;

  @Column({ name: 'delivery_instructions', type: 'text', nullable: true })
  deliveryInstructions: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
