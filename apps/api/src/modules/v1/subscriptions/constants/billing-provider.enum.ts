export enum BillingProvider {
  NOMBA = 'nomba',
  MONNIFY = 'monnify',
  BACHS = 'bachs',
  POLAR = 'polar',
}

export function isManagedSubscriptionProvider(provider: BillingProvider): boolean {
  return provider === BillingProvider.BACHS || provider === BillingProvider.POLAR;
}
