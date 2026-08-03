import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { FileUploadLocation } from '../enums/file-upload-location.enum';

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const UPLOAD_CONTENT_TYPE_HINT =
  'Unsupported file type. Allowed: PDF, PNG, JPEG, WebP, GIF, SVG, CSV, Word (.docx), or Excel (.xlsx).';

export class GenerateUploadUrlDto {
  @IsEnum(FileUploadLocation)
  @ApiProperty({ enum: FileUploadLocation, example: FileUploadLocation.DOCUMENTS })
  location: FileUploadLocation;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'contract.pdf' })
  originalName: string;

  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES, { message: UPLOAD_CONTENT_TYPE_HINT })
  @IsOptional()
  @ApiProperty({
    required: false,
    example: 'application/pdf',
    enum: ALLOWED_UPLOAD_CONTENT_TYPES,
  })
  contentType?: string;
}
