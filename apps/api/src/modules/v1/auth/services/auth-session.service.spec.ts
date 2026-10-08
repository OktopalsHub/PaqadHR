import { parseDurationToMs } from 'src/common/config/parse-duration.util';

/**
 * Duration helpers on AuthSessionService read ENVIRONMENT at call time.
 * Boot-time validation lives in resolveRefreshAndSessionExpiresIn (unit-tested).
 * Here we only assert the shared parser contract the helpers rely on.
 */
describe('auth session duration parsing contract', () => {
  it('maps 7d to seven days in ms (cookie / session fallback)', () => {
    expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('maps 15m to fifteen minutes in ms (access cookie)', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
  });
});
