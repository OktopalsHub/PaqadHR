import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PlatformIntegration } from './platform-integration.entity';
import { TenantMember } from '../../../modules/v1/tenant-members/entities/tenant-member.entity';
import { BaseEntity } from '../../database/entities/base.entity';

@Entity('platform_users')
export class PlatformUser extends BaseEntity {
  @Column({ name: 'integration_id' })
  integrationId: string;
  @ManyToOne(
    () => PlatformIntegration,
    (integration) => integration.platformUsers,
  )
  @JoinColumn({ name: 'integration_id' })
  integration: PlatformIntegration;
  @Column({ name: 'tenant_member_id', nullable: true }) 
  tenantMemberId: string | null;
  @ManyToOne(() => TenantMember, { nullable: true })
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember | null;
  @Column({ name: 'platform_user_id' })
  platformUserId: string;
  @Column({ name: 'platform_username' })
  platformUsername: string;
  @Column({ name: 'platform_display_name', nullable: true })
  platformDisplayName: string;
  @Column({ name: 'platform_email', nullable: true })
  platformEmail: string;
  @Column({ name: 'platform_avatar_url', nullable: true })
  platformAvatarUrl: string;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
