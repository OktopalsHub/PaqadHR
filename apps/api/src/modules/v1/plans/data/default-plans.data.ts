import { FeatureAccess } from 'src/common/enums/subscription.enum';
import type { PlanRegionalConfig } from 'src/common/interfaces/plan-regional-config.interface';

export interface DefaultPlanSeed {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  prices: Array<{
    countryCode: string;
    currency: string;
    monthlyPrice: number;
    yearlyPrice: number;
    regionalConfig: PlanRegionalConfig;
  }>;
}

const starterRegionalUsd: PlanRegionalConfig = {
  pricePerUser: 3,
  minimumUsers: 1,
  includedUsers: 25,
  overagePricePerUser: 3,
  payrollFeePercentage: 3,
};

const growthRegionalUsd: PlanRegionalConfig = {
  pricePerUser: 5,
  minimumUsers: 1,
  includedUsers: 50,
  overagePricePerUser: 4,
  payrollFeePercentage: 2.5,
};

const scaleRegionalUsd: PlanRegionalConfig = {
  pricePerUser: 9,
  minimumUsers: 1,
  includedUsers: 100,
  overagePricePerUser: 7,
  payrollFeePercentage: 2,
};

const starterRegionalNg: PlanRegionalConfig = {
  pricePerUser: 2500,
  minimumUsers: 1,
  includedUsers: 25,
  overagePricePerUser: 2000,
  payrollFeePercentage: 3,
};

const growthRegionalNg: PlanRegionalConfig = {
  pricePerUser: 3500,
  minimumUsers: 1,
  includedUsers: 50,
  overagePricePerUser: 3000,
  payrollFeePercentage: 2.5,
};

const scaleRegionalNg: PlanRegionalConfig = {
  pricePerUser: 7500,
  minimumUsers: 1,
  includedUsers: 100,
  overagePricePerUser: 6000,
  payrollFeePercentage: 2,
};

export const DEFAULT_PLANS: DefaultPlanSeed[] = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'Core HR for small teams getting started.',
    sortOrder: 0,
    features: {
      [FeatureAccess.BASIC_HR]: true,
      [FeatureAccess.LEAVE_MANAGEMENT]: true,
      [FeatureAccess.EMPLOYEE_SELF_SERVICE]: true,
      [FeatureAccess.ATTENDANCE]: true,
      [FeatureAccess.PAYROLL]: true,
      [FeatureAccess.RECRUITMENT]: true,
    },
    limits: { maxEmployees: 25 },
    prices: [
      {
        countryCode: 'GLOBAL',
        currency: 'USD',
        monthlyPrice: 3,
        yearlyPrice: 30,
        regionalConfig: starterRegionalUsd,
      },
      {
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 2500,
        yearlyPrice: 25000,
        regionalConfig: starterRegionalNg,
      },
    ],
  },
  {
    slug: 'growth',
    name: 'Growth',
    description: 'HR + payroll and recruitment for scaling teams.',
    sortOrder: 1,
    features: {
      [FeatureAccess.BASIC_HR]: true,
      [FeatureAccess.LEAVE_MANAGEMENT]: true,
      [FeatureAccess.EMPLOYEE_SELF_SERVICE]: true,
      [FeatureAccess.ATTENDANCE]: true,
      [FeatureAccess.PAYROLL]: true,
      [FeatureAccess.RECRUITMENT]: true,
      [FeatureAccess.INTEGRATIONS]: true,
      [FeatureAccess.ADVANCED_REPORTING]: true,
    },
    limits: { maxEmployees: 100 },
    prices: [
      {
        countryCode: 'GLOBAL',
        currency: 'USD',
        monthlyPrice: 5,
        yearlyPrice: 50,
        regionalConfig: growthRegionalUsd,
      },
      {
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 3500,
        yearlyPrice: 35000,
        regionalConfig: growthRegionalNg,
      },
    ],
  },
  {
    slug: 'scale',
    name: 'Scale',
    description: 'Full platform for established HR operations.',
    sortOrder: 2,
    features: {
      [FeatureAccess.BASIC_HR]: true,
      [FeatureAccess.LEAVE_MANAGEMENT]: true,
      [FeatureAccess.EMPLOYEE_SELF_SERVICE]: true,
      [FeatureAccess.ATTENDANCE]: true,
      [FeatureAccess.ADVANCED_ATTENDANCE]: true,
      [FeatureAccess.PAYROLL]: true,
      [FeatureAccess.ADVANCED_PAYROLL]: true,
      [FeatureAccess.RECRUITMENT]: true,
      [FeatureAccess.PERFORMANCE_MANAGEMENT]: true,
      [FeatureAccess.INTEGRATIONS]: true,
      [FeatureAccess.API_ACCESS]: true,
      [FeatureAccess.MULTI_LOCATION]: true,
      [FeatureAccess.ADVANCED_REPORTING]: true,
      [FeatureAccess.COMPLIANCE_REPORTING]: true,
    },
    limits: { maxEmployees: 500 },
    prices: [
      {
        countryCode: 'GLOBAL',
        currency: 'USD',
        monthlyPrice: 9,
        yearlyPrice: 90,
        regionalConfig: scaleRegionalUsd,
      },
      {
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 7500,
        yearlyPrice: 75000,
        regionalConfig: scaleRegionalNg,
      },
    ],
  },
];
