describe('google-oauth-consent', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('src/common/config/env.config', () => ({
      ENVIRONMENT: { JWT: { ACCESS_SECRET: 'test-access-secret-min-32-chars!!' } },
    }));
    jest.doMock('src/common/config/privacy.config', () => ({
      getPrivacyPolicyVersion: () => '1.0',
    }));
  });

  it('round-trips consent claims and rejects tampering or version drift helpers', async () => {
    const { createHmac } = await import('node:crypto');
    const {
      consentTokensMatch,
      createGoogleOAuthConsentClaims,
      signGoogleOAuthConsent,
      verifyGoogleOAuthConsent,
    } = await import('./google-oauth-state.util');

    const claims = createGoogleOAuthConsentClaims();
    expect(claims.termsAccepted).toBe(true);
    expect(claims.privacyPolicyVersion).toBe('1.0');

    const token = signGoogleOAuthConsent(claims);
    expect(verifyGoogleOAuthConsent(token)).toEqual(claims);
    expect(consentTokensMatch(token, token)).toBe(true);
    expect(consentTokensMatch(token, `${token}x`)).toBe(false);
    expect(verifyGoogleOAuthConsent(undefined)).toBeNull();
    expect(verifyGoogleOAuthConsent(`${token}x`)).toBeNull();

    const [payload] = token.split('.');
    const forgedSig = createHmac('sha256', 'wrong-secret').update(payload).digest('base64url');
    expect(verifyGoogleOAuthConsent(`${payload}.${forgedSig}`)).toBeNull();

    expect(
      verifyGoogleOAuthConsent(
        signGoogleOAuthConsent({
          ...claims,
          termsAccepted: false,
        }),
      )?.termsAccepted,
    ).toBe(false);
  });
});
