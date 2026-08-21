import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators';
export class LocalLoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email',
  })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;
  @ApiProperty({
    description: 'User password',
    example: 'StrongPassword123!',
  })
  @IsString()
  @ApiProperty({
    description: 'password',
  })
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    description: 'Remember me for 30 days',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
