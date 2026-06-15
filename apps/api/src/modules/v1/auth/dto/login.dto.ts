import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
export class LocalLoginDto {
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
    description: 'User password',
    example: 'StrongPassword123!',
  })
  @IsString()
  @ApiProperty({
    description: 'password',
  })
  @IsNotEmpty()
  password: string;
}
