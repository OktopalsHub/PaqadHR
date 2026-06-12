import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PlatformIntegration } from './platform-integration.entity';
import { ChannelType } from 'src/common/enums';
import { BaseEntity } from '../../database/entities/base.entity';

@Entity('integration_channels')
export class IntegrationChannel extends BaseEntity {
  @Column({ name: 'integration_id' })
  integrationId: string;
  @ManyToOne(() => PlatformIntegration, (integration) => integration.channels)
  @JoinColumn({ name: 'integration_id' })
  integration: PlatformIntegration;
  @Column({ name: 'platform_channel_id' })
  platformChannelId: string;
  @Column({ name: 'platform_channel_name' })
  platformChannelName: string;
  @Column({ type: 'enum', enum: ChannelType, default: ChannelType.SHOUTOUTS })
  channelType: ChannelType;
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;
  @Column({ name: 'team_id', nullable: true })
  teamId: string; 
  @Column({ name: 'department_id', nullable: true })
  departmentId: string; 
  @Column({ name: 'category_filter', type: 'json', nullable: true })
  categoryFilter: string[]; 
  @Column({ name: 'min_points_threshold', default: 0 })
  minPointsThreshold: number; 
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'created_by' })
  createdBy: string; 
}
