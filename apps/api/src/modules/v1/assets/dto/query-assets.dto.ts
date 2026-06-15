import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AssetCondition, AssetStatus, AssetType } from 'src/common/enums';
export class QueryAssetsDto {
  @IsOptional()
  @ApiProperty({
    description: 'type',
    required: false,
    enum: AssetType,
  })
  @IsEnum(AssetType)
  type?: AssetType;
  @IsOptional()
  @ApiProperty({
    description: 'category id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  categoryId?: string;
  @IsOptional()
  @ApiProperty({
    description: 'status',
    required: false,
    enum: AssetStatus,
  })
  @IsEnum(AssetStatus)
  status?: AssetStatus;
  @IsOptional()
  @ApiProperty({
    description: 'condition',
    required: false,
    enum: AssetCondition,
  })
  @IsEnum(AssetCondition)
  condition?: AssetCondition;
  @IsOptional()
  @ApiProperty({
    description: 'assigned to id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  assignedToId?: string;
  @IsOptional()
  @ApiProperty({
    description: 'search',
    required: false,
  })
  @IsString()
  search?: string;
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;
}
