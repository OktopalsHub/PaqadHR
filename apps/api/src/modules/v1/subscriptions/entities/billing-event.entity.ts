import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'billing_events' })
@Index(['eventId', 'provider'], { unique: true })
export class BillingEvent extends BaseEntity {
  @Column({ name: 'event_id', type: 'varchar', length: 255 })
  eventId: string;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;
}
