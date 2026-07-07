import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Optional when refresh_token httpOnly cookie is set' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
