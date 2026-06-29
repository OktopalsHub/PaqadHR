import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { PaySchedule, PayType } from 'src/common/enums';

export class CreateCompensationDto {
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'When the new salary takes effect',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsNotEmpty()
  effectiveDate: Date;

  @IsNumber()
  @IsPositive()
  @ApiProperty({
    description: 'Pay rate amount',
    example: 150000,
  })
  @IsNotEmpty()
  payRate: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(PayType)
  @ApiProperty({
    description: 'Pay type',
    required: false,
  })
  @IsOptional()
  payType?: PayType = PayType.SALARY;

  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(PaySchedule)
  @ApiProperty({
    description: 'Pay schedule',
    required: false,
  })
  @IsOptional()
  paySchedule?: PaySchedule = PaySchedule.MONTHLY;

  @IsString()
  @ApiProperty({
    description: 'Optional note about this salary change',
    required: false,
  })
  @IsOptional()
  comments?: string;
}
