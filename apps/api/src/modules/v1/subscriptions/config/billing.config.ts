import { isNombaConfigured } from './nomba.config';

/** Feature access is always gated by subscription plan state. */
export function isFeatureGatingEnabled(): boolean {
  return true;
}

/** Card / Nomba billing — enabled when Nomba credentials are configured. */
export function isBillingGatewayEnabled(): boolean {
  return isNombaConfigured();
}

export function assertBillingGatewayAllowed(): void {
  if (!isBillingGatewayEnabled()) {
    throw new Error(
      'Nomba billing is not configured. Set NOMBA_CLIENT_ID, NOMBA_CLIENT_SECRET, and NOMBA_ACCOUNT_ID.',
    );
  }
}
