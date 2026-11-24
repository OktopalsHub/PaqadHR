import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsOptional } from 'class-validator';

export class PublicTenantQueryDto {
  @ApiProperty({ description: 'Workspace ID' })
  @IsUUID()
  tenantId!: string;
}

export class PublicLimitQueryDto extends PublicTenantQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class PublicSuggestionQueryDto extends PublicTenantQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  query!: string;
}
