import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ApplicationAccessDto {
  @ApiProperty({ example: 'applicant@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
