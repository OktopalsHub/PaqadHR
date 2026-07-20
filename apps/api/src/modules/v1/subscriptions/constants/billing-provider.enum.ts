export enum BillingProvider {
  NOMBA = 'nomba',
  BACHS = 'bachs',
  POLAR = 'polar',
}

export function isManagedSubscriptionProvider(provider: BillingProvider): boolean {
  return provider === BillingProvider.BACHS || provider === BillingProvider.POLAR;
}
