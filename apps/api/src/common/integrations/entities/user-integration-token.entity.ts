import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PlatformIntegration } from './platform-integration.entity';
import { IntegrationType } from 'src/common/enums';
import { TenantMember } from '../../../modules/v1/tenant-members/entities/tenant-member.entity';
import { BaseEntity } from '../../database/entities/base.entity';

@Entity('user_integration_tokens')
export class UserIntegrationToken extends BaseEntity {
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember;
  @Column({ name: 'integration_id' })
  integrationId: string;
  @ManyToOne(() => PlatformIntegration)
  @JoinColumn({ name: 'integration_id' })
  integration: PlatformIntegration;
  @Column({ type: 'enum', enum: IntegrationType })
  platformType: IntegrationType;
  @Column({ name: 'user_access_token', type: 'text' })
  userAccessToken: string; 
  @Column({ name: 'user_refresh_token', type: 'text', nullable: true })
  userRefreshToken: string;
  @Column({ name: 'platform_user_id' })
  platformUserId: string;
  @Column({ name: 'platform_username' })
  platformUsername: string;
  @Column({ name: 'scopes', type: 'json' })
  scopes: string[]; 
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;
}
