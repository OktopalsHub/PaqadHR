import { IsNumber, Max, Min } from 'class-validator';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';

export class WalletTopupDto {
  @IsNumber()
  @Min(1)
  @Max(WALLET_TOPUP_MAX_AMOUNT)
  amount: number;
}
