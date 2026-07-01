import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('misdirected_deposits')
export class MisdirectedDeposit extends BaseEntity {
  @Column({ name: 'account_number', type: 'varchar' })
  accountNumber: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;
}
