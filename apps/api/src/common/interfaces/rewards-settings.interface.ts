export interface RewardsSettings {
  enabled: boolean;

  pointsExchangeRate: number;

  rewardsCurrency: string;

  catalogCountries: string[];

  airtimeEnabled: boolean;

  customRewardsEnabled: boolean;

  giftCardsEnabled?: boolean;

  giftCardCategories?: string[];

  utilityPaymentsEnabled?: boolean;

  reloadlyProducts?: Array<{
    productId: number;
    name: string;
    pointsCost: number;
    imageUrl: string | null;
    countryCode: string;
    currencyCode: string;
    minDenomination?: number | null;
    maxDenomination?: number | null;
    fixedDenominations?: number[];
    listReloadlyCost?: number | null;
    listReloadlyCostCurrency?: string;
  }>;
}
