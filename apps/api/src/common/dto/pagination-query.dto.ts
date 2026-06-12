import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PaginationQueryDto {
  @ApiProperty({
    required: false,
    description: 'Page number for pagination',
    example: '1',
  })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    example: '10',
  })
  @IsOptional()
  @IsString()
  limit?: string;
}
