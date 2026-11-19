import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'wallet_provider_webhook_events' })
@Index('uq_wallet_provider_webhook_event', ['provider', 'eventId'], { unique: true })
export class ProviderWebhookEvent extends BaseEntity {
  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'event_id', type: 'varchar', length: 255 })
  eventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'event_object_id', type: 'varchar', length: 255, nullable: true })
  eventObjectId: string | null;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;
}
