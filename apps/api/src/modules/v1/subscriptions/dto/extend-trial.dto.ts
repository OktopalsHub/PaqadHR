import { IsInt, Max, Min } from 'class-validator';

export class ExtendTrialDto {
  @IsInt()
  @Min(1)
  @Max(365)
  additionalDays: number;
}
