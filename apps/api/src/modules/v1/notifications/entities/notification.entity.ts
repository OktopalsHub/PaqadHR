import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationStatus } from '../../../../common/enums/notification-status.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('notifications')
@Index(['tenantId', 'recipientId', 'status'])
@Index(['type', 'createdAt'])
@Index(['recipientId', 'readAt'])
export class Notification extends BaseEntity {
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;
  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;
  @Column()
  title: string;
  @Column('text')
  message: string;
  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;
  @Column('jsonb', { nullable: true })
  actionData: {
    url?: string;
    buttonText?: string;
    actionType?: string;
  };
  @Column('uuid', { nullable: true })
  tenantId: string | null;
  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column('uuid', { nullable: true })
  recipientId: string | null;
  @ManyToOne(() => TenantMember, { nullable: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient: TenantMember;
  @Column({ nullable: true })
  emailTemplate: string;
  @Column('jsonb', { nullable: true })
  emailContext: Record<string, any>;
  @Column({ nullable: true })
  emailSubject: string;
  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
  @Column('text', { nullable: true })
  errorMessage: string;
  @Column({ default: 0 })
  retryCount: number;
}
