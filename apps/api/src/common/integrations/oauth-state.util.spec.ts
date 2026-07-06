import { IntegrationType } from 'src/common/enums';
import { signOAuthState, verifyOAuthState } from './oauth-state.util';

describe('oauth-state.util', () => {
  const payload = {
    tenantId: 'tenant-1',
    tenantMemberId: 'member-1',
    platformType: IntegrationType.SLACK,
    timestamp: Date.now(),
  };

  it('round-trips a signed state', () => {
    const state = signOAuthState(payload);
    expect(verifyOAuthState(state)).toEqual(payload);
  });

  it('rejects tampered signature', () => {
    const state = signOAuthState(payload);
    const [encoded] = state.split('.');
    expect(() => verifyOAuthState(`${encoded}.invalid-signature`)).toThrow(
      'Invalid OAuth state signature',
    );
  });

  it('rejects oversized state', () => {
    expect(() => verifyOAuthState('a'.repeat(2049))).toThrow('Invalid OAuth state length');
  });
});
