import {
  buildUserConsentMetadata,
  getCurrentPrivacyPolicyVersion,
  needsPrivacyPolicyReconsent,
} from './user-metadata.interface';

describe('privacy policy consent helpers', () => {
  it('requires reconsent when no version recorded', () => {
    expect(needsPrivacyPolicyReconsent(null)).toBe(true);
    expect(needsPrivacyPolicyReconsent({})).toBe(true);
  });

  it('requires reconsent when version is stale', () => {
    const current = getCurrentPrivacyPolicyVersion();
    expect(
      needsPrivacyPolicyReconsent({
        consent: { privacyPolicyVersion: '0.9', termsAcceptedAt: '2026-01-01' },
      }),
    ).toBe(current !== '0.9');
  });

  it('records current policy version on consent', () => {
    const metadata = buildUserConsentMetadata(true);
    expect(metadata.consent?.privacyPolicyVersion).toBe(getCurrentPrivacyPolicyVersion());
    expect(needsPrivacyPolicyReconsent(metadata)).toBe(false);
  });
});
