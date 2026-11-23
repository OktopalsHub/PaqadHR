import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('rate_limit_lockouts')
export class RateLimitLockout {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'int' })
  count: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Index('ix_rate_limit_lockouts_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
