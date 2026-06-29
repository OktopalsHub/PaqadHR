export interface PlanRegionalConfig {
  pricePerUser: number;
  minimumUsers: number;
  includedUsers: number;
  overagePricePerUser: number;
  payrollFeePercentage: number;
  rewardsFeePercentage?: number;
  rewardsFlatFee?: number;
  featureLimits?: Record<string, number>;
  regionalFeatures?: Record<string, unknown>;
}
