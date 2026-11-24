import { UnauthorizedException } from '@nestjs/common';

import { GoogleStrategy } from './google.strategy';

jest.mock('../utils/google-oauth-state.util', () => ({
  GOOGLE_OAUTH_CONSENT_COOKIE_BASE: 'consent',
  consentTokensMatch: jest.fn().mockReturnValue(true),
  verifyGoogleOAuthConsent: jest
    .fn()
    .mockReturnValue({ termsAccepted: true, privacyPolicyVersion: 'v1' }),
}));
jest.mock('src/common/config/privacy.config', () => ({
  getPrivacyPolicyVersion: () => 'v1',
}));

describe('GoogleStrategy', () => {
  const findOrCreateGoogleUser = jest.fn().mockResolvedValue({ id: 'user-1' });
  const req = { headers: {}, query: { state: 's' }, cookies: {}, socket: {} } as never;
  let strategy: GoogleStrategy;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost/cb';
    findOrCreateGoogleUser.mockClear();
    strategy = new GoogleStrategy({ findOrCreateGoogleUser } as never);
  });

  it('rejects a profile whose email is not verified', async () => {
    await expect(
      strategy.validate(req, 'a', 'r', {
        id: 'g1',
        emails: [{ value: 'a@example.com', verified: false }],
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it('rejects a profile that carries no verification flag', async () => {
    await expect(
      strategy.validate(req, 'a', 'r', { id: 'g1', emails: [{ value: 'a@example.com' }] }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a profile with a verified email', async () => {
    await strategy.validate(req, 'a', 'r', {
      id: 'g1',
      emails: [{ value: 'A@example.com', verified: true }],
    });
    expect(findOrCreateGoogleUser).toHaveBeenCalledWith(
      'g1',
      'a@example.com',
      expect.anything(),
      true,
      'v1',
    );
  });
});
