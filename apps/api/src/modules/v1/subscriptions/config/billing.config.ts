export type BillingMode = 'trial' | 'manual' | 'open';

export function getBillingMode(): BillingMode {
  const mode = (process.env.BILLING_MODE || 'trial').toLowerCase();
  if (mode === 'manual' || mode === 'open') {
    return mode;
  }
  return 'trial';
}

/** When false, all plan features are accessible (beta). */
export function isFeatureGatingEnabled(): boolean {
  return getBillingMode() !== 'open';
}

/** Card / Nomba charges — not enabled in trial or manual billing. */
export function isBillingGatewayEnabled(): boolean {
  return false;
}

export function assertBillingGatewayAllowed(): void {
  if (!isBillingGatewayEnabled()) {
    throw new Error(
      'Card billing is disabled. Use BILLING_MODE=trial or manual and activate tenants via admin.',
    );
  }
}
