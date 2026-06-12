import { Leave } from '../../leave/entities/leave.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({
    description: 'Leave type name',
    example: 'Annual Leave',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;
  @ApiPropertyOptional({
    description: 'Leave type description',
    example: 'Annual paid time off',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
  @ApiPropertyOptional({
    description: 'Default number of days for this leave type',
    example: 20,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDays?: number;
  @ApiPropertyOptional({
    description: 'Whether the leave type is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
