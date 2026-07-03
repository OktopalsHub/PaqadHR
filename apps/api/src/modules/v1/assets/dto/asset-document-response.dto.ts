import { ApiProperty } from '@nestjs/swagger';
import { FileUrlMapper } from '../../../../common/mappers/file-url.mapper';
import { FileUrlService } from '../../../../common/services/file-url.service';
import type { AssetDocument } from '../document/entities/asset-document.entity';

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
    example: 'https://custom-domain.com/tenants/123/assets/asset-doc_1731668445123.pdf',
    required: false,
  })
  fileUrl?: string;
  @ApiProperty({ description: 'File size in bytes', required: false })
  size?: number;
  @ApiProperty({ description: 'MIME type', required: false })
  mimeType?: string;
  @ApiProperty({ description: 'Additional metadata', required: false })
  metadata?: Record<string, unknown>;
  @ApiProperty({ description: 'Asset ID' })
  assetId: string;
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;
}
export class AssetDocumentMapper {
  static toResponse(
    document: AssetDocument,
    tenantId: string,
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
    };
    if (fileUrlService && document.imageKey) {
      response.fileUrl =
        FileUrlMapper.mapAssetDocument(document.imageKey, {
          tenantId,
          fileUrlService,
        }) || undefined;
    }
    return response;
  }
  static toResponseList(
    documents: AssetDocument[],
    tenantId: string,
    fileUrlService?: FileUrlService,
  ): AssetDocumentResponseDto[] {
    return documents.map((document) =>
      AssetDocumentMapper.toResponse(document, tenantId, fileUrlService),
    );
  }
}
