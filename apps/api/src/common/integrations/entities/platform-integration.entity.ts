import { IntegrationType } from 'src/common/enums';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from '../../../modules/v1/tenants/entities/tenant.entity';
import { BaseEntity } from '../../database/entities/base.entity';
import { IntegrationChannel } from './integration-channel.entity';
import { PlatformUser } from './platform-user.entity';

@Entity('platform_integrations')
export class PlatformIntegration extends BaseEntity {
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ type: 'enum', enum: IntegrationType })
  type: IntegrationType;
  @Column({ name: 'platform_team_id' })
  platformTeamId: string;
  @Column({ name: 'platform_team_name' })
  platformTeamName: string;
  @Column({ name: 'bot_token', type: 'text', nullable: true })
  botToken: string;
  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string;
  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string;
  @Column({ name: 'webhook_url', nullable: true })
  webhookUrl: string;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;
  @OneToMany(
    () => PlatformUser,
    (user) => user.integration,
  )
  platformUsers: PlatformUser[];
  @OneToMany(
    () => IntegrationChannel,
    (channel) => channel.integration,
  )
  channels: IntegrationChannel[];
}
