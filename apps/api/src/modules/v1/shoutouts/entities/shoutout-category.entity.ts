import {
  Column,
  Entity
} from 'typeorm';
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('shoutout_categories')
export class ShoutoutCategory extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
