import type { GiftCardProvider } from '../utils/rewards-defaults.util';

export interface RewardsSettings {
  enabled: boolean;

  pointsExchangeRate: number;

  rewardsCurrency: string;

  catalogCountries: string[];

  airtimeEnabled: boolean;

  customRewardsEnabled: boolean;

  giftCardsEnabled?: boolean;

  giftCardCategories?: string[];

  giftCardProvider?: GiftCardProvider;

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
    wholesaleInRewardsCurrency?: number;
  }>;

  tremendousProducts?: Array<{
    productId: string;
    name: string;
    pointsCost: number;
    imageUrl: string | null;
    countryCode: string;
    /** All provider countries this product ships to (ISO alpha-2). */
    countries?: string[];
    currencyCode: string;
    minDenomination?: number | null;
    maxDenomination?: number | null;
    fixedDenominations?: number[];
    listTremendousCost?: number | null;
    listTremendousCostCurrency?: string;
    wholesaleInRewardsCurrency?: number;
    category?: string;
    subcategory?: string;
  }>;
}
