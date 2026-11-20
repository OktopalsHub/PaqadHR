import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class LeaveDashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-11-20', description: "The viewer's local date" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'today must be YYYY-MM-DD' })
  today?: string;
}
