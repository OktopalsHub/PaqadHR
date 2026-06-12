import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class ListShoutoutsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Comma-separated category IDs',
    example: 'uuid-1,uuid-2',
  })
  @IsOptional()
  @IsString()
  categoryIds?: string;

  @ApiPropertyOptional({ description: 'Filter by sender member ID' })
  @IsOptional()
  @IsUUID()
  senderId?: string;

  @ApiPropertyOptional({ description: 'Filter by recipient member ID' })
  @IsOptional()
  @IsUUID()
  recipientId?: string;
}
