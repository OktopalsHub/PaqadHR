import { IsNumber, Min } from 'class-validator';

export class WalletTopupDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
