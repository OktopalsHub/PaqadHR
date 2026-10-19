import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNumber,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ApproveRetryFundingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  itemIds!: string[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000000000)
  expectedAmount!: number;

  @IsIn(['USD', 'NGN'])
  currency!: 'USD' | 'NGN';
}
