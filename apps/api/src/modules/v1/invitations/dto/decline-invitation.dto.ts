import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators';

export class DeclineInvitationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ format: 'email' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
