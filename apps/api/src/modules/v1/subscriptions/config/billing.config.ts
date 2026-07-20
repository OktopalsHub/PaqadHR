import { isNoahConfigured } from 'src/common/config/noah.config';
import { isNombaConfigured } from './nomba.config';

export function isFeatureGatingEnabled(): boolean {
  return true;
}

export function isBillingGatewayEnabled(): boolean {
  return isNombaConfigured() || isNoahConfigured();
}

export function assertBillingGatewayAllowed(): void {
  if (!isBillingGatewayEnabled()) {
    throw new Error(
      'Billing is not configured. Set Nomba credentials for NGN or Noah credentials for other currencies.',
    );
  }
}
