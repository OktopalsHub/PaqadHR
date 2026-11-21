import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class DeletePaymentMethodDto {
  @ApiPropertyOptional({ description: '6-digit payment passcode', example: '123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Passcode must be exactly 6 digits' })
  passcode?: string;
}
