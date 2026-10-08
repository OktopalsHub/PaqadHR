import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService.getSessionDurationMs', () => {
  it('uses the configured SESSION_EXPIRES_IN default (15m)', () => {
    expect(AuthSessionService.getSessionDurationMs()).toBe(15 * 60 * 1000);
  });
});
