import { Leave } from '../../leave/entities/leave.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, MaxLength } from 'class-validator';
export class CreateLeaveTypeDto {
  @ApiProperty({
    description: 'Leave type name',
    example: 'Annual Leave',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  name: string;
  @ApiProperty({
    description: 'Leave type description',
    example: 'Annual paid time off',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  description: string;
  @ApiProperty({
    description: 'Default number of days for this leave type',
    example: 20,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  defaultDays: number;
}
