import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService.getSessionDurationMs', () => {
  it('defaults to 7 days when unset or invalid', () => {
    expect(AuthSessionService.getSessionDurationMs(undefined)).toBe(7 * 24 * 60 * 60 * 1000);
    expect(AuthSessionService.getSessionDurationMs('nope')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('parses supported duration units', () => {
    expect(AuthSessionService.getSessionDurationMs('30s')).toBe(30_000);
    expect(AuthSessionService.getSessionDurationMs('15m')).toBe(15 * 60 * 1000);
    expect(AuthSessionService.getSessionDurationMs('2h')).toBe(2 * 60 * 60 * 1000);
    expect(AuthSessionService.getSessionDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
