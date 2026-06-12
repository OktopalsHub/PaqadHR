import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne
} from 'typeorm';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Shoutout } from './shoutout.entity';
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('shoutout_recipients')
export class ShoutoutRecipient extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'shoutout_id', type: 'uuid' })
  shoutoutId: string;

  @ManyToOne(() => Shoutout, (shoutout) => shoutout.recipients)
  @JoinColumn({ name: 'shoutout_id' })
  shoutout: Shoutout;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'recipient_id' })
  recipient: TenantMember;

  @Column({ type: 'int' })
  points: number;
}
