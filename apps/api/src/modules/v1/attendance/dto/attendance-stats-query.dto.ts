import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class AttendanceStatsQueryDto {
  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;
}
