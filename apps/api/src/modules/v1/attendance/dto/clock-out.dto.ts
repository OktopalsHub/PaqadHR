import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';
export class ClockOutDto {
  @IsString()
  @ApiProperty({
    description: 'location',
    required: false,
  })
  @IsOptional()
  location?: string;

  @IsString()
  @ApiProperty({
    description: 'notes',
    required: false,
  })
  @IsOptional()
  notes?: string;

  @IsDateString()
  @ApiProperty({
    description: 'Custom clock out time',
    required: false,
    type: String,
  })
  @IsOptional()
  clockOut?: string;
}
