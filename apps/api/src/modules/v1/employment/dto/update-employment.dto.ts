import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmploymentStatus, PaySchedule, PayType } from 'src/common/enums';
export class UpdateEmploymentDto {
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'hire date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  startDate?: Date;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'position start date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  positionStartDate?: Date;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'end date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  endDate?: Date;
  @IsEnum(EmploymentStatus)
  @ApiProperty({
    description: 'status',
    required: false,
  })
  @IsOptional()
  status?: EmploymentStatus;
  @IsUUID()
  @ApiProperty({
    description: 'position id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  positionId?: string;
  @IsUUID()
  @ApiProperty({
    description: 'reports to id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  reportsToId?: string;
  @IsEnum(PayType)
  @ApiProperty({
    description: 'pay type',
    required: false,
  })
  @IsOptional()
  payType?: PayType;
  @IsEnum(PaySchedule)
  @ApiProperty({
    description: 'pay schedule',
    required: false,
  })
  @IsOptional()
  paySchedule?: PaySchedule;
  @IsNumber()
  @ApiProperty({
    description: 'pay rate',
    required: false,
    example: 100,
  })
  @IsOptional()
  payRate?: number;
  @IsString()
  @ApiProperty({
    description: 'comments',
    required: false,
  })
  @IsOptional()
  comments?: string;
}
