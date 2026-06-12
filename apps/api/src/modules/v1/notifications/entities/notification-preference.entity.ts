import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { NotificationPreferenceType } from "../../../../common/enums/notification-preference-type.enum";
import { NotificationChannel } from "../../../../common/enums/notification-channel.enum";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('notification_preferences')
@Index(['tenantMemberId', 'notificationType'], { unique: true })
export class NotificationPreference extends BaseEntity {
  @Column('uuid')
  tenantMemberId: string;
  @ManyToOne(() => TenantMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember;
  @Column({ type: 'enum', enum: NotificationPreferenceType })
  notificationType: NotificationPreferenceType;
  @Column({ type: 'enum', enum: NotificationChannel })
  preferredChannel: NotificationChannel;
  @Column({ default: true })
  isEnabled: boolean;
  @Column({ default: false })
  emailEnabled: boolean;
  @Column({ default: true })
  inAppEnabled: boolean;
  @Column({ type: 'time', nullable: true })
  quietHoursStart: string | null;
  @Column({ type: 'time', nullable: true })
  quietHoursEnd: string | null;
  @Column('text', { array: true, default: '{}' })
  quietDays: string[];
}
