import {
  DEFAULT_PRIVACY_POLICY_VERSION,
  getPrivacyPolicyVersion,
  isPrivacyReconsentEnabled,
} from 'src/common/config/privacy.config';

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

/**
 * Reconsent when the recorded version does not match PRIVACY_POLICY_VERSION.
 * Missing version is treated as DEFAULT_PRIVACY_POLICY_VERSION (legacy accounts).
 * Disable entirely with PRIVACY_RECONSENT_ENABLED=false.
 */
export function needsPrivacyPolicyReconsent(metadata?: UserMetadata | null): boolean {
  if (!isPrivacyReconsentEnabled()) {
    return false;
  }
  const acceptedVersion =
    getUserConsent(metadata)?.privacyPolicyVersion ?? DEFAULT_PRIVACY_POLICY_VERSION;
  return acceptedVersion !== getCurrentPrivacyPolicyVersion();
}
