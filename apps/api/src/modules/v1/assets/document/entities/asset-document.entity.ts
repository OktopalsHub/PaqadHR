import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../../common/database/entities/base.entity';
import { Tenant } from '../../../tenants/entities/tenant.entity';
import { Asset } from '../../entities/asset.entity';

@Entity({ name: 'asset_documents' })
export class AssetDocument extends BaseEntity {
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column()
  type: string;
  @Column({ name: 'document_name' })
  documentName: string;
  @Column({ name: 'image_key' })
  imageKey: string;
  @Column({ type: 'bigint', nullable: true })
  size?: number;
  @Column({ name: 'mime_type', nullable: true })
  mimeType?: string;
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;
  @Column({ name: 'asset_id' })
  assetId: string;
  @ManyToOne(
    () => Asset,
    (asset) => asset.documents,
    { onDelete: 'CASCADE' },
  )
  asset: Asset;
}
