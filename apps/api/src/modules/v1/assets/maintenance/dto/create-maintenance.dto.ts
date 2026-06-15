import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { MaintenanceType } from 'src/common/enums';
export class CreateMaintenanceDto {
  @ApiProperty({
    description: 'maintenance date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  maintenanceDate: string;
  @ApiProperty({
    description: 'type',
    enum: MaintenanceType,
  })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;
  @ApiProperty({
    description: 'description',
  })
  @IsString()
  description: string;
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  cost?: number;
  @IsOptional()
  @ApiProperty({
    description: 'performed by',
    required: false,
  })
  @IsString()
  performedBy?: string;
  @IsOptional()
  @ApiProperty({
    description: 'next maintenance date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  nextMaintenanceDate?: string;
  @IsOptional()
  @ApiProperty({
    description: 'notes',
    required: false,
  })
  @IsString()
  notes?: string;
}
