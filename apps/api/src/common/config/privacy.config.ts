import { getOptional, getOptionalBoolean } from './env.util';

/** Default when PRIVACY_POLICY_VERSION is unset. Bump in .env when the policy changes materially. */
export const DEFAULT_PRIVACY_POLICY_VERSION = '1.0';

export function getPrivacyPolicyVersion(): string {
  return getOptional('PRIVACY_POLICY_VERSION', DEFAULT_PRIVACY_POLICY_VERSION);
}

/**
 * When false, the app does not force re-consent dialogs.
 * Default true. Set PRIVACY_RECONSENT_ENABLED=false in local/dev to suppress the gate.
 */
export function isPrivacyReconsentEnabled(): boolean {
  return getOptionalBoolean('PRIVACY_RECONSENT_ENABLED', true);
}
