import {
  parseDurationToMs,
  resolveJwtDurationString,
  resolveRefreshAndSessionExpiresIn,
} from './parse-duration.util';

describe('parse-duration.util', () => {
  it('parses supported units', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
    expect(parseDurationToMs('2h')).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('rejects invalid durations', () => {
    expect(parseDurationToMs(undefined)).toBeNull();
    expect(parseDurationToMs('')).toBeNull();
    expect(parseDurationToMs('nope')).toBeNull();
    expect(parseDurationToMs('0d')).toBeNull();
    expect(parseDurationToMs('10M')).toBeNull();
  });

  it('resolves fallback and normalizes case', () => {
    expect(resolveJwtDurationString(undefined, '7d')).toBe('7d');
    expect(resolveJwtDurationString(' 7D ', '7d')).toBe('7d');
  });

  it('throws on invalid configured strings', () => {
    expect(() => resolveJwtDurationString('10oops', '7d')).toThrow(/Invalid JWT duration/);
    expect(() => resolveJwtDurationString('2592000000', '7d')).toThrow(/Invalid JWT duration/);
  });

  it('defaults refresh and session to 7d and allows equal values', () => {
    expect(resolveRefreshAndSessionExpiresIn(undefined, undefined)).toEqual({
      REFRESH_EXPIRES_IN: '7d',
      SESSION_EXPIRES_IN: '7d',
    });
    expect(resolveRefreshAndSessionExpiresIn('14d', undefined)).toEqual({
      REFRESH_EXPIRES_IN: '14d',
      SESSION_EXPIRES_IN: '14d',
    });
  });

  it('rejects session shorter than refresh', () => {
    expect(() => resolveRefreshAndSessionExpiresIn('7d', '1d')).toThrow(
      /greater than or equal/,
    );
  });
});
