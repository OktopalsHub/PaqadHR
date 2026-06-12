import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { DocumentType } from "../../../../common/enums/document-type.enum";

export class CreateDocumentDto {
  @IsString()
  @ApiProperty({
    description: 'name',
    example: 'Example Name',
  })
  @IsNotEmpty()
  name: string;
  @IsEnum(DocumentType)
  @ApiProperty({
    description: 'type',
  })
  @IsNotEmpty()
  type: DocumentType;
  @IsString()
  @ApiProperty({
    description: 'File key from upload URL response',
    example: 'tenants/123/documents/passport_123.pdf',
  })
  @IsNotEmpty()
  fileKey: string;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'issue date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  issueDate?: Date;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'expiry date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  expiryDate?: Date;
  @IsString()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsOptional()
  description?: string;
  @ApiProperty({
    description: 'is verified',
    required: false,
    example: true,
  })
  @IsOptional()
  isVerified?: boolean = false;
}
