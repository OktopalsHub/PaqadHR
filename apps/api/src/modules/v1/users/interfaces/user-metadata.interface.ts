import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';

export interface UserConsentMetadata {
  termsAcceptedAt?: string;
  privacyPolicyVersion?: string;
}

export interface UserMetadata {
  consent?: UserConsentMetadata;
}

export function buildUserConsentMetadata(termsAccepted = true): UserMetadata {
  if (!termsAccepted) {
    throw new Error('Terms must be accepted to register');
  }

  return {
    consent: {
      termsAcceptedAt: new Date().toISOString(),
      privacyPolicyVersion: getPrivacyPolicyVersion(),
    },
  };
}

export function getUserConsent(metadata?: UserMetadata | null): UserConsentMetadata | null {
  return metadata?.consent ?? null;
}

export function getCurrentPrivacyPolicyVersion(): string {
  return getPrivacyPolicyVersion();
}

export function needsPrivacyPolicyReconsent(metadata?: UserMetadata | null): boolean {
  const acceptedVersion = getUserConsent(metadata)?.privacyPolicyVersion;
  if (!acceptedVersion) {
    return true;
  }
  return acceptedVersion !== getCurrentPrivacyPolicyVersion();
}
