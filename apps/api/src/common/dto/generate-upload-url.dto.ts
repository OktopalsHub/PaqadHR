import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { FileUploadLocation } from '../enums/file-upload-location.enum';

const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export class GenerateUploadUrlDto {
  @IsEnum(FileUploadLocation)
  @ApiProperty({ enum: FileUploadLocation, example: FileUploadLocation.DOCUMENTS })
  location: FileUploadLocation;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'contract.pdf' })
  originalName: string;

  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES)
  @IsOptional()
  @ApiProperty({
    required: false,
    example: 'application/pdf',
    enum: ALLOWED_UPLOAD_CONTENT_TYPES,
  })
  contentType?: string;
}
