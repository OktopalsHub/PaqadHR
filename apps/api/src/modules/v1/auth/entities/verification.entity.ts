import { BaseEntity } from 'src/common/database/entities/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity('verification')
@Index(['identifier', 'token'], { unique: true })
export class Verification extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  identifier: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;
}
