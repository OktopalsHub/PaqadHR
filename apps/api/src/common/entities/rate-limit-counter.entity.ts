import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('rate_limit_counters')
export class RateLimitCounter {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'int' })
  count: number;

  @Index('ix_rate_limit_counters_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
