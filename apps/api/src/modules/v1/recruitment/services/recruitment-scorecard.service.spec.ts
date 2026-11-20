import { BadRequestException } from '@nestjs/common';

import { summariseScorecards, validateRatings } from './recruitment-scorecard.service';

describe('scorecard helpers', () => {
  it('rejects out-of-range or non-integer ratings', () => {
    expect(() => validateRatings({ Skills: 5 })).toThrow(BadRequestException);
    expect(() => validateRatings({ Skills: 2.5 })).toThrow(BadRequestException);
    expect(() => validateRatings({})).toThrow(BadRequestException);
    expect(validateRatings({ Skills: 4 })).toEqual({ Skills: 4 });
  });

  it('averages ratings and recommendations across reviewers', () => {
    const summary = summariseScorecards([
      { ratings: { Skills: 4, Communication: 2 }, recommendation: 'STRONG_YES' },
      { ratings: { Skills: 3 }, recommendation: 'NO' },
    ]);
    expect(summary).toEqual({ count: 2, averageRating: 3, averageRecommendation: 3 });
    expect(summariseScorecards([])).toEqual({
      count: 0,
      averageRating: null,
      averageRecommendation: null,
    });
  });
});
