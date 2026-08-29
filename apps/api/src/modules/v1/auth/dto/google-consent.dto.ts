import { Equals, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleConsentDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms and privacy policy to continue' })
  termsAccepted: boolean;
}
