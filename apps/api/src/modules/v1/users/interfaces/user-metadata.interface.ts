export interface UserConsentMetadata {
  termsAcceptedAt?: string;
  privacyPolicyVersion?: string;
}

export interface UserMetadata {
  consent?: UserConsentMetadata;
}

export function buildUserConsentMetadata(
  termsAccepted = true,
  privacyPolicyVersion?: string,
): UserMetadata {
  if (termsAccepted !== true) {
    throw new Error('Terms must be accepted to register');
  }

  return {
    consent: {
      termsAcceptedAt: new Date().toISOString(),
      privacyPolicyVersion:
        privacyPolicyVersion?.trim() || process.env.PRIVACY_POLICY_VERSION || '1.0',
    },
  };
}

export function getUserConsent(metadata?: UserMetadata | null): UserConsentMetadata | null {
  return metadata?.consent ?? null;
}
