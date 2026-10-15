import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class ListShoutoutsQueryDto extends PaginationDto {
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
