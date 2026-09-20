import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { PaymentProvider } from '../../../../common/enums/payment-provider.enum';

@Entity({ name: 'payroll_webhook_events' })
@Index(['provider', 'eventId'], { unique: true })
export class PayrollWebhookEvent extends BaseEntity {
  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  @Column({ name: 'event_id', type: 'varchar', length: 255 })
  eventId: string;

  @Column({ name: 'received_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt: Date;
}
