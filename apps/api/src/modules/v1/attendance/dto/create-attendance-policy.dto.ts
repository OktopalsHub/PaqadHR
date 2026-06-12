import { ApiProperty } from '@nestjs/swagger';
import {
  IsMilitaryTime,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';
export class CreateAttendancePolicyDto {
  @IsString()
  @ApiProperty({
    description: 'name',
    example: 'Example Name',
  })
  @IsNotEmpty()
  name: string;
  @IsString()
  @ApiProperty({
    description: 'description',
  })
  @IsNotEmpty()
  description: string;
  @IsMilitaryTime()
  @ApiProperty({
    description: 'work start time',
  })
  @IsNotEmpty()
  workStartTime: string;
  @IsMilitaryTime()
  @ApiProperty({
    description: 'work end time',
  })
  @IsNotEmpty()
  workEndTime: string;
  @IsNumber()
  @ApiProperty({
    description: 'late threshold',
    example: 100,
  })
  @IsNotEmpty()
  lateThreshold: number;
  @IsNumber()
  @ApiProperty({
    description: 'half day threshold',
    example: 100,
  })
  @IsNotEmpty()
  halfDayThreshold: number;
  @IsNumber()
  @ApiProperty({
    description: 'grace period',
    example: 100,
  })
  @IsNotEmpty()
  gracePeriod: number;
  @IsNumber()
  @ApiProperty({
    description: 'max sessions per day',
    example: 100,
  })
  @IsNotEmpty()
  maxSessionsPerDay: number;
}
