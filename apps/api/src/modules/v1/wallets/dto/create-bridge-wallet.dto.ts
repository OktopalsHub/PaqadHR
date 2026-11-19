import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class CreateBridgeWalletDto {
  @ApiProperty({ enum: ['USDC', 'USDT'] })
  @IsIn(['USDC', 'USDT'])
  currency: 'USDC' | 'USDT';

  @ApiProperty({ example: 'solana' })
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]{2,32}$/)
  network: string;
}
