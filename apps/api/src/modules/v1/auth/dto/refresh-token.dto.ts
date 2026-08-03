import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Development only; production requires refresh_token httpOnly cookie',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
