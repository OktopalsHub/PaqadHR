import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmploymentStatus, PaySchedule, PayType } from 'src/common/enums';
export class CreateEmploymentDto {
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'hire date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsNotEmpty()
  startDate: Date;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'position start date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsNotEmpty()
  positionStartDate: Date;
  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'end date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  endDate?: Date;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(EmploymentStatus)
  @ApiProperty({
    description: 'status',
    required: false,
  })
  @IsOptional()
  status?: EmploymentStatus = EmploymentStatus.ACTIVE;
  @IsUUID()
  @ApiProperty({
    description: 'position id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  positionId: string;
  @IsUUID()
  @ApiProperty({
    description: 'reports to id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  reportsToId?: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(PayType)
  @ApiProperty({
    description: 'pay type',
    required: false,
  })
  @IsOptional()
  payType?: PayType = PayType.SALARY;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(PaySchedule)
  @ApiProperty({
    description: 'pay schedule',
    required: false,
  })
  @IsOptional()
  paySchedule?: PaySchedule = PaySchedule.MONTHLY;
  @IsNumber()
  @ApiProperty({
    description: 'pay rate',
    example: 100,
  })
  @IsNotEmpty()
  payRate: number;
  @IsString()
  @ApiProperty({
    description: 'comments',
    required: false,
  })
  @IsOptional()
  comments?: string;
}
