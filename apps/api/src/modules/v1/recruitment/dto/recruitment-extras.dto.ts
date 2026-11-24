import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';

export class SubmitScorecardDto {
  @IsObject()
  ratings: Record<string, number>;

  @IsIn(['STRONG_YES', 'YES', 'NO', 'STRONG_NO'])
  recommendation: 'STRONG_YES' | 'YES' | 'NO' | 'STRONG_NO';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class CreateOfferDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000)
  amount: number;

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
  currency: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SendOfferDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class RespondOfferDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  outcome: 'ACCEPTED' | 'DECLINED';
}

export class TalentPoolDto {
  @IsBoolean()
  inPool: boolean;
}
