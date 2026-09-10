import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSubscriptionPaymentMethodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  successUrl?: string;
}
