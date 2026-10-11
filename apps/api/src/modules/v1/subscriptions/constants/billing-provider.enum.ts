export enum BillingProvider {
  NOMBA = 'nomba',
  MONNIFY = 'monnify',
  BACHS = 'bachs',
}

export function isManagedSubscriptionProvider(provider: BillingProvider): boolean {
  return provider === BillingProvider.BACHS;
}
