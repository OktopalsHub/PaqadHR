import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';

export class WalletTopupDto {
  @IsNumber()
  @Min(1)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  amount: number;
}

export class WalletTopupCompleteDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  orderReference: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  amount?: number;

  /** Monnify transactionReference from init / redirect — verify fallback. */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  transactionReference?: string;
}
