import {
  DEFAULT_PRIVACY_POLICY_VERSION,
  getPrivacyPolicyVersion,
  isPrivacyReconsentEnabled,
} from './privacy.config';

describe('privacy.config', () => {
  const originalVersion = process.env.PRIVACY_POLICY_VERSION;
  const originalEnabled = process.env.PRIVACY_RECONSENT_ENABLED;

  afterEach(() => {
    if (originalVersion === undefined) {
      delete process.env.PRIVACY_POLICY_VERSION;
    } else {
      process.env.PRIVACY_POLICY_VERSION = originalVersion;
    }
    if (originalEnabled === undefined) {
      delete process.env.PRIVACY_RECONSENT_ENABLED;
    } else {
      process.env.PRIVACY_RECONSENT_ENABLED = originalEnabled;
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

  it('defaults reconsent enabled to true', () => {
    delete process.env.PRIVACY_RECONSENT_ENABLED;
    expect(isPrivacyReconsentEnabled()).toBe(true);
  });

  it('disables reconsent when PRIVACY_RECONSENT_ENABLED=false', () => {
    process.env.PRIVACY_RECONSENT_ENABLED = 'false';
    expect(isPrivacyReconsentEnabled()).toBe(false);
  });
});
