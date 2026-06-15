import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OauthProvider, UserRole } from 'src/common/enums';
export class OAuthSignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @ApiProperty({
    description: 'email',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    description: 'OAuth Provider',
    enum: OauthProvider,
  })
  @IsString()
  @ApiProperty({
    description: 'provider',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  provider: OauthProvider;
  @ApiProperty({
    description: 'Provider-specific user ID',
    example: '12345678',
  })
  @IsString()
  @ApiProperty({
    description: 'provider id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  providerId: string;
  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    default: UserRole.BASIC,
  })
  @IsString()
  @ApiProperty({
    description: 'role',
    required: false,
  })
  @IsOptional()
  role?: string = UserRole.BASIC;
}
