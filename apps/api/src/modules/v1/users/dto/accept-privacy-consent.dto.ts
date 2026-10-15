import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean } from 'class-validator';

export class AcceptPrivacyConsentDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the updated privacy policy to continue' })
  termsAccepted: boolean;
}
