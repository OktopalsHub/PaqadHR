import { isNombaConfigured } from './nomba.config';

export function isFeatureGatingEnabled(): boolean {
  return true;
}

export function isBillingGatewayEnabled(): boolean {
  return isNombaConfigured();
}

export function assertBillingGatewayAllowed(): void {
  if (!isBillingGatewayEnabled()) {
    throw new Error(
      'Nomba billing is not configured. Set NOMBA_CLIENT_ID, NOMBA_CLIENT_SECRET, and NOMBA_PARENT_ACCOUNT_ID.',
    );
  }
}
