import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdatePaymentCurrencyDto {
  @ApiProperty({ example: 'NGN', description: 'ISO 4217 currency code' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  currency: string;
}
