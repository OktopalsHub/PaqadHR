import { Matches } from 'class-validator';

const PLAN_SLUG_PATTERN = /^(starter|growth|scale)$/;

export class StartTrialDto {
  @Matches(PLAN_SLUG_PATTERN, { message: 'planSlug must be starter, growth, or scale' })
  planSlug: string;
}
