import { IsIn, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class LinkBridgeExternalAccountDto {
  @IsUUID('4')
  tenantId: string;

  @IsUUID('4')
  paymentMethodId: string;

  @IsIn(['USDC', 'USDT'])
  sourceCurrency: 'USDC' | 'USDT';

  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]{2,32}$/)
  network: string;
}
