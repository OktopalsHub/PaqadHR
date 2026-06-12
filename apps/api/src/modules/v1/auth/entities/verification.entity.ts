import { BaseEntity } from 'src/common/database/entities/base.entity';
import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';

@Entity('verification')
@Index(['identifier', 'token'], { unique: true })
export class Verification extends BaseEntity {
  @Column({ length: 100 })
  identifier: string;

  @Column({ length: 255, unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
