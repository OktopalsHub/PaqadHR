import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export class SetPasscodeDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'passcode',
    example: 'ABC123',
  })
  @IsString()
  passcode: string;
}
export class VerifyPasscodeDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'passcode',
    example: 'ABC123',
  })
  @IsString()
  passcode: string;
}
