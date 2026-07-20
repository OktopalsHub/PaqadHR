import { IsBoolean, IsNumber, Min } from 'class-validator';

export class WalletAutoTopupDto {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(0)
  threshold: number;

  @IsNumber()
  @Min(1)
  amount: number;
}
