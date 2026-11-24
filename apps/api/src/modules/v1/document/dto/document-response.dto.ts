import { ApiProperty } from '@nestjs/swagger';

import { DocumentType } from '../../../../common/enums/document-type.enum';
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
  static toResponse(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      description: document.description,
      isVerified: document.isVerified,
      tenantMemberId: document.tenantMemberId,
      tenantId: document.tenantId,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt?.toISOString(),
    };
  }
  static toResponseList(documents: Document[]): DocumentResponseDto[] {
    return documents.map((document) => DocumentMapper.toResponse(document));
  }
}
