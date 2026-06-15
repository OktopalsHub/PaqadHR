import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../../../common/enums/document-type.enum';
import { FileUrlMapper } from '../../../../common/mappers/file-url.mapper';
import { FileUrlService } from '../../../../common/services/file-url.service';
import type { Document } from '../entities/document.entity';

export class DocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;
  @ApiProperty({ description: 'Document name' })
  name: string;
  @ApiProperty({
    description: 'Document type',
    enum: DocumentType,
    example: DocumentType.PASSPORT,
  })
  type: DocumentType;
  @ApiProperty({ description: 'File storage key' })
  fileKey: string;
  @ApiProperty({
    description: 'Document URL (constructed from fileKey)',
    example: 'https://custom-domain.com/tenants/123/documents/passport_1731668445123.pdf',
    required: false,
  })
  fileUrl?: string;
  @ApiProperty({ description: 'Issue date', required: false })
  issueDate?: Date;
  @ApiProperty({ description: 'Expiry date', required: false })
  expiryDate?: Date;
  @ApiProperty({ description: 'Document description', required: false })
  description?: string;
  @ApiProperty({ description: 'Whether document is verified' })
  isVerified: boolean;
  @ApiProperty({ description: 'Tenant member ID' })
  tenantMemberId: string;
  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;
  @ApiProperty({ description: 'Last update timestamp', required: false })
  updatedAt?: string;
}
export class DocumentMapper {
  static toResponse(document: Document, fileUrlService?: FileUrlService): DocumentResponseDto {
    const response: DocumentResponseDto = {
      id: document.id,
      name: document.name,
      type: document.type,
      fileKey: document.fileKey,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      description: document.description,
      isVerified: document.isVerified,
      tenantMemberId: document.tenantMemberId,
      tenantId: document.tenantId,
      createdAt: document.createdAt.toISOString(),
    };
    if (fileUrlService && document.fileKey) {
      response.fileUrl =
        FileUrlMapper.mapDocument(document.fileKey, {
          tenantId: document.tenantId,
          fileUrlService,
        }) || undefined;
    }
    return response;
  }
  static toResponseList(
    documents: Document[],
    fileUrlService?: FileUrlService,
  ): DocumentResponseDto[] {
    return documents.map((document) => DocumentMapper.toResponse(document, fileUrlService));
  }
}
