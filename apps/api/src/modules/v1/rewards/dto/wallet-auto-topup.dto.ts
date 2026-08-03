import { IsBoolean, IsNumber, Max, Min } from 'class-validator';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';

export class WalletAutoTopupDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(0)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  threshold: number;

  @IsNumber()
  @Min(1)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  amount: number;
}
