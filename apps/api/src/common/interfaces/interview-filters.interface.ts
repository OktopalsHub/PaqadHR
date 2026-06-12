import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { InterviewStatus, InterviewType } from 'src/common/enums';
export class InterviewFilters {
  @ApiPropertyOptional({ enum: InterviewStatus })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;
  @ApiPropertyOptional({ enum: InterviewType })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobOpeningId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  interviewerId?: string;
}
