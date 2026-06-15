import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AssetCondition, AssetType } from 'src/common/enums';
export class AssetLocationDto {
  @IsOptional()
  @ApiProperty({
    description: 'building',
    required: false,
  })
  @IsString()
  building?: string;
  @IsOptional()
  @ApiProperty({
    description: 'floor',
    required: false,
  })
  @IsString()
  floor?: string;
  @IsOptional()
  @ApiProperty({
    description: 'room',
    required: false,
  })
  @IsString()
  room?: string;
  @IsOptional()
  @ApiProperty({
    description: 'location notes',
    required: false,
  })
  @IsString()
  locationNotes?: string;
}
export class CreateAssetDto {
  @ApiProperty({
    description: 'name',
    example: 'Example Name',
  })
  @IsString()
  name: string;
  @ApiProperty({
    description: 'type',
    enum: AssetType,
  })
  @IsEnum(AssetType)
  type: AssetType;
  @ApiProperty({
    description: 'category id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  categoryId: string;
  @IsOptional()
  @ApiProperty({
    description: 'serial number',
    required: false,
  })
  @IsString()
  serialNumber?: string;
  @IsOptional()
  @ApiProperty({
    description: 'model',
    required: false,
  })
  @IsString()
  model?: string;
  @IsOptional()
  @ApiProperty({
    description: 'manufacturer',
    required: false,
  })
  @IsString()
  manufacturer?: string;
  @ApiProperty({
    description: 'purchase date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  purchaseDate: string;
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  purchasePrice: number;
  @IsOptional()
  @ApiProperty({
    description: 'warranty expiry',
    required: false,
  })
  @IsDateString()
  warrantyExpiry?: string;
  @ApiProperty({
    description: 'condition',
    enum: AssetCondition,
  })
  @IsEnum(AssetCondition)
  condition: AssetCondition;
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetLocationDto)
  location?: AssetLocationDto;
  @IsOptional()
  @ApiProperty({
    description: 'notes',
    required: false,
  })
  @IsString()
  notes?: string;
}
