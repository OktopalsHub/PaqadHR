import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import type { TenantSettingsData } from '../../../../common/interfaces/tenant-settings-data.interface';

@Entity('tenant_settings')
@Index(['tenantId'], { unique: true })
export class TenantSettings extends BaseEntity {
  @Column('uuid')
  tenantId: string;
  @Column('jsonb')
  settings: TenantSettingsData;
}
