import { DEFAULT_PRIVACY_POLICY_VERSION } from 'src/common/config/privacy.config';
import {
  buildUserConsentMetadata,
  getCurrentPrivacyPolicyVersion,
  needsPrivacyPolicyReconsent,
} from './user-metadata.interface';

describe('privacy policy consent helpers', () => {
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

  it('treats missing version as default — no reconsent when env matches default', () => {
    delete process.env.PRIVACY_POLICY_VERSION;
    delete process.env.PRIVACY_RECONSENT_ENABLED;
    expect(needsPrivacyPolicyReconsent(null)).toBe(false);
    expect(needsPrivacyPolicyReconsent({})).toBe(false);
    expect(DEFAULT_PRIVACY_POLICY_VERSION).toBe('1.0');
  });

  it('requires reconsent when env version is newer than recorded', () => {
    process.env.PRIVACY_POLICY_VERSION = '2.0';
    delete process.env.PRIVACY_RECONSENT_ENABLED;
    expect(
      needsPrivacyPolicyReconsent({
        consent: { privacyPolicyVersion: '1.0', termsAcceptedAt: '2026-01-01' },
      }),
    ).toBe(true);
  });

  it('skips reconsent when PRIVACY_RECONSENT_ENABLED=false', () => {
    process.env.PRIVACY_POLICY_VERSION = '9.9';
    process.env.PRIVACY_RECONSENT_ENABLED = 'false';
    expect(
      needsPrivacyPolicyReconsent({
        consent: { privacyPolicyVersion: '1.0' },
      }),
    ).toBe(false);
  });

  it('records current policy version on consent', () => {
    delete process.env.PRIVACY_RECONSENT_ENABLED;
    const metadata = buildUserConsentMetadata(true);
    expect(metadata.consent?.privacyPolicyVersion).toBe(getCurrentPrivacyPolicyVersion());
    expect(needsPrivacyPolicyReconsent(metadata)).toBe(false);
  });
});
