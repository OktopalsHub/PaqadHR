describe('google-oauth-state', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('src/common/config/env.config', () => ({
      ENVIRONMENT: { JWT: { ACCESS_SECRET: 'test-access-secret-min-32-chars!!' } },
    }));
  });

  it('round-trips termsAccepted and rejects tampering', async () => {
    const { createHmac } = await import('node:crypto');
    const { signGoogleOAuthState, verifyGoogleOAuthState } = await import(
      './google-oauth-state.util'
    );

    const accepted = signGoogleOAuthState(true);
    expect(verifyGoogleOAuthState(accepted)).toEqual({ termsAccepted: true });
    expect(verifyGoogleOAuthState(signGoogleOAuthState(false))).toEqual({ termsAccepted: false });
    expect(verifyGoogleOAuthState(undefined)).toEqual({ termsAccepted: false });
    expect(verifyGoogleOAuthState(`${accepted}x`)).toEqual({ termsAccepted: false });

    const [payload] = accepted.split('.');
    const forgedSig = createHmac('sha256', 'wrong-secret').update(payload).digest('base64url');
    expect(verifyGoogleOAuthState(`${payload}.${forgedSig}`)).toEqual({ termsAccepted: false });
  });
});
