import { Asset } from '../../entities/asset.entity';
import { Document } from '../../../document/entities/document.entity';
import { ApiProperty } from '@nestjs/swagger';
import { FileUrlMapper } from '../../../../../common/mappers/file-url.mapper';
import { FileUrlService } from '../../../../../common/services/file-url.service';
import { AssetDocument } from '../entities/asset-document.entity';

export class AssetDocumentResponseDto {
  @ApiProperty({ description: 'Asset document ID' })
  id: string;
  @ApiProperty({ description: 'Document type' })
  type: string;
  @ApiProperty({ description: 'Document name' })
  documentName: string;
  @ApiProperty({ description: 'Image storage key' })
  imageKey: string;
  @ApiProperty({
    description: 'Document URL (constructed from imageKey)',
    example:
      'https://custom-domain.com/tenants/123/assets/document_1731668445123.pdf',
    required: false,
  })
  imageUrl?: string;
  @ApiProperty({ description: 'File size in bytes', required: false })
  size?: number;
  @ApiProperty({ description: 'MIME type', required: false })
  mimeType?: string;
  @ApiProperty({ description: 'Additional metadata', required: false })
  metadata?: Record<string, any>;
  @ApiProperty({ description: 'Asset ID' })
  assetId: string;
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;
  @ApiProperty({ description: 'Last update timestamp', required: false })
  updatedAt?: string;
}
export class AssetDocumentMapper {
  static toResponse(
    document: AssetDocument,
    tenantId?: string,
    fileUrlService?: FileUrlService,
  ): AssetDocumentResponseDto {
    const response: AssetDocumentResponseDto = {
      id: document.id,
      type: document.type,
      documentName: document.documentName,
      imageKey: document.imageKey,
      size: document.size,
      mimeType: document.mimeType,
      metadata: document.metadata,
      assetId: document.assetId,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt?.toISOString(),
    };
    if (tenantId && fileUrlService && document.imageKey) {
      response.imageUrl =
        FileUrlMapper.mapAssetDocument(document.imageKey, {
          tenantId,
          fileUrlService,
        }) || undefined;
    }
    return response;
  }
  static toResponseList(
    documents: AssetDocument[],
    tenantId?: string,
    fileUrlService?: FileUrlService,
  ): AssetDocumentResponseDto[] {
    return documents.map((doc) =>
      this.toResponse(doc, tenantId, fileUrlService),
    );
  }
}
