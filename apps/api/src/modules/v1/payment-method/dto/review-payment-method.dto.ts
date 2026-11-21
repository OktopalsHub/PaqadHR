import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';

export const REVIEW_PAYMENT_METHOD_STATUSES = [
  PaymentMethodStatus.VERIFIED,
  PaymentMethodStatus.REJECTED,
  PaymentMethodStatus.SUSPENDED,
] as const;

export class ReviewPaymentMethodDto {
  @ApiProperty({ enum: REVIEW_PAYMENT_METHOD_STATUSES })
  @IsIn(REVIEW_PAYMENT_METHOD_STATUSES)
  status: PaymentMethodStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
