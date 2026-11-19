import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DraftEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  purpose: string;

  @IsString()
  @IsIn(['friendly', 'formal', 'warm', 'concise'])
  tone: string;
}

export class DraftJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  notes?: string;
}
