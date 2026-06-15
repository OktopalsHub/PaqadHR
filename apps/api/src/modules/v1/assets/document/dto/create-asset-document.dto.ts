import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
export class CreateAssetDocumentDto {
  @ApiProperty({ example: 'purchase_receipt' })
  @IsString()
  @ApiProperty({
    description: 'type',
  })
  @IsNotEmpty()
  type: string;
  @ApiProperty({ example: 'MacBook Pro Purchase Receipt' })
  @IsString()
  @ApiProperty({
    description: 'document name',
    example: 'Example Name',
  })
  @IsNotEmpty()
  documentName: string;
  @ApiProperty({ example: 'asset-uuid' })
  @IsString()
  @ApiProperty({
    description: 'asset id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  assetId: string;
  @ApiProperty({ example: 'some-key-in-storage' })
  @IsString()
  @ApiProperty({
    description: 'image key',
  })
  @IsNotEmpty()
  imageKey: string;
  @ApiPropertyOptional({ example: 123456 })
  @IsOptional()
  @ApiProperty({
    description: 'size',
    required: false,
    example: 100,
  })
  @IsNumber()
  size?: number;
  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @ApiProperty({
    description: 'mime type',
    required: false,
  })
  @IsString()
  mimeType?: string;
  @ApiPropertyOptional({ example: { originalName: 'receipt.pdf' } })
  @IsOptional()
  @ApiProperty({
    description: 'metadata',
    required: false,
  })
  @IsObject()
  metadata?: Record<string, any>;
}
