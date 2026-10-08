import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Deprecated: refresh token must be provided via the refresh_token httpOnly cookie, not the request body.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
