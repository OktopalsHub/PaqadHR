import { resolveAuthRateLimitMax } from './express-rate-limiters';

describe('resolveAuthRateLimitMax', () => {
  it('defaults to 5 when unset or blank', () => {
    expect(resolveAuthRateLimitMax(undefined)).toBe(5);
    expect(resolveAuthRateLimitMax('')).toBe(5);
    expect(resolveAuthRateLimitMax('   ')).toBe(5);
  });

  it('accepts positive integers', () => {
    expect(resolveAuthRateLimitMax('10')).toBe(10);
  });

  it('rejects invalid values', () => {
    expect(() => resolveAuthRateLimitMax('10oops')).toThrow(/positive integer/);
    expect(() => resolveAuthRateLimitMax('-1')).toThrow(/positive integer/);
    expect(() => resolveAuthRateLimitMax('0')).toThrow(/positive integer/);
    expect(() => resolveAuthRateLimitMax('1.5')).toThrow(/positive integer/);
  });
});
