export interface RewardsSettings {
  /** Whether the rewards redemption system is enabled for this tenant */
  enabled: boolean;
  /** Points-to-currency exchange rate, e.g. 10 means 1 point = 10 NGN */
  pointsExchangeRate: number;
  /** The currency code for rewards, e.g. NGN */
  rewardsCurrency: string;
  /** Allowed ISO country codes for Reloadly gift card catalog (e.g. ['NG', 'US']) */
  catalogCountries: string[];
  /** Whether Nomba airtime vending is enabled */
  airtimeEnabled: boolean;
  /** Whether custom rewards are enabled */
  customRewardsEnabled: boolean;
  /** Active configured Reloadly gift card products */
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
  }>;
}
