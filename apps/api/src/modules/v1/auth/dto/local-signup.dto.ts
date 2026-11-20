import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from 'src/common/constants/password-policy.constant';
export class LocalSignupDto {
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
    description: `User password (min ${MIN_PASSWORD_LENGTH} characters)`,
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_PASSWORD_LENGTH, { message: PASSWORD_MIN_LENGTH_MESSAGE })
  password: string;
}
