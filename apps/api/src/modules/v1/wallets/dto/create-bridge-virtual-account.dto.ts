import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class CreateBridgeVirtualAccountDto {
  @ApiProperty({ enum: ['USD', 'EUR', 'GBP', 'NGN'] })
  @IsIn(['USD', 'EUR', 'GBP', 'NGN'])
  sourceCurrency: 'USD' | 'EUR' | 'GBP' | 'NGN';

  @ApiProperty({ enum: ['USDC', 'USDT'] })
  @IsIn(['USDC', 'USDT'])
  destinationCurrency: 'USDC' | 'USDT';

  @ApiProperty({ example: 'SOL' })
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]{2,32}$/)
  network: string;
}
