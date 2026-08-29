import { getOptional } from './env.util';

/** Default when PRIVACY_POLICY_VERSION is unset. Bump in .env when the policy changes materially. */
export const DEFAULT_PRIVACY_POLICY_VERSION = '1.0';

export function getPrivacyPolicyVersion(): string {
  return getOptional('PRIVACY_POLICY_VERSION', DEFAULT_PRIVACY_POLICY_VERSION);
}
