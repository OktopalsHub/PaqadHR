import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SubmitScorecardDto } from '../dto/recruitment-extras.dto';
import { Candidate } from '../entities/candidate.entity';
import { RecruitmentScorecard } from '../entities/recruitment-scorecard.entity';

export const SCORECARD_ATTRIBUTES = [
  'Skills',
  'Communication',
  'Problem solving',
  'Culture add',
] as const;

const RECOMMENDATION_SCORE = { STRONG_YES: 4, YES: 3, NO: 2, STRONG_NO: 1 } as const;

export function validateRatings(ratings: Record<string, number>): Record<string, number> {
  const entries = Object.entries(ratings);
  if (entries.length === 0 || entries.length > 10) {
    throw new BadRequestException('Provide between 1 and 10 ratings');
  }
  for (const [key, value] of entries) {
    if (key.length === 0 || key.length > 40 || !Number.isInteger(value) || value < 1 || value > 4) {
      throw new BadRequestException('Each rating needs a short name and a whole score from 1 to 4');
    }
  }
  return Object.fromEntries(entries);
}

export function summariseScorecards(
  cards: Array<Pick<RecruitmentScorecard, 'ratings' | 'recommendation'>>,
) {
  if (cards.length === 0) return { count: 0, averageRating: null, averageRecommendation: null };
  const ratings = cards.flatMap((card) => Object.values(card.ratings));
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    count: cards.length,
    averageRating: ratings.length
      ? round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
      : null,
    averageRecommendation: round(
      cards.reduce((sum, card) => sum + RECOMMENDATION_SCORE[card.recommendation], 0) /
        cards.length,
    ),
  };
}

@Injectable()
export class RecruitmentScorecardService {
  constructor(
    @InjectRepository(RecruitmentScorecard)
    private readonly scorecards: Repository<RecruitmentScorecard>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
  ) {}

  async submit(tenantId: string, candidateId: string, memberId: string, dto: SubmitScorecardDto) {
    const exists = await this.candidates.exists({ where: { id: candidateId, tenantId } });
    if (!exists) throw new NotFoundException('Candidate not found');
    const ratings = validateRatings(dto.ratings);
    await this.scorecards.upsert(
      {
        tenantId,
        candidateId,
        reviewerMemberId: memberId,
        ratings,
        recommendation: dto.recommendation,
        notes: dto.notes ?? null,
      },
      ['candidateId', 'reviewerMemberId'],
    );
    return this.list(tenantId, candidateId);
  }

  async list(tenantId: string, candidateId: string) {
    const cards = await this.scorecards.find({
      where: { tenantId, candidateId },
      select: {
        id: true,
        reviewerMemberId: true,
        ratings: true,
        recommendation: true,
        notes: true,
        updatedAt: true,
      },
      order: { updatedAt: 'DESC' },
    });
    return {
      attributes: SCORECARD_ATTRIBUTES,
      scorecards: cards,
      summary: summariseScorecards(cards),
    };
  }
}
