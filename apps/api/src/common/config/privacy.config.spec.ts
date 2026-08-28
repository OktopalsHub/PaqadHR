import { DEFAULT_PRIVACY_POLICY_VERSION, getPrivacyPolicyVersion } from './privacy.config';

describe('privacy.config', () => {
  const original = process.env.PRIVACY_POLICY_VERSION;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PRIVACY_POLICY_VERSION;
    } else {
      process.env.PRIVACY_POLICY_VERSION = original;
    }
  });

  it('defaults to 1.0 when unset', () => {
    delete process.env.PRIVACY_POLICY_VERSION;
    expect(getPrivacyPolicyVersion()).toBe(DEFAULT_PRIVACY_POLICY_VERSION);
  });

  it('reads PRIVACY_POLICY_VERSION from env', () => {
    process.env.PRIVACY_POLICY_VERSION = '2.1';
    expect(getPrivacyPolicyVersion()).toBe('2.1');
  });
});
