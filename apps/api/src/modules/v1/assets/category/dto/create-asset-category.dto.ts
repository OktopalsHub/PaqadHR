import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
export class CreateAssetCategoryDto {
  @ApiProperty({
    description: 'name',
    example: 'Example Name',
  })
  @IsString()
  name: string;
  @IsOptional()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsString()
  description?: string;
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  depreciationRate?: number;
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  maintenanceFrequencyMonths?: number;
  @IsOptional()
  @ApiProperty({
    description: 'maintenance description',
    required: false,
  })
  @IsString()
  maintenanceDescription?: string;
}
