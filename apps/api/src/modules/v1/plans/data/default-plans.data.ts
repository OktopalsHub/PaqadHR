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

const starterRegional: PlanRegionalConfig = {
  pricePerUser: 8,
  minimumUsers: 1,
  includedUsers: 25,
  overagePricePerUser: 8,
  payrollFeePercentage: 3,
};

const growthRegional: PlanRegionalConfig = {
  pricePerUser: 15,
  minimumUsers: 1,
  includedUsers: 50,
  overagePricePerUser: 12,
  payrollFeePercentage: 2.5,
};

const scaleRegional: PlanRegionalConfig = {
  pricePerUser: 35,
  minimumUsers: 1,
  includedUsers: 100,
  overagePricePerUser: 25,
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
        monthlyPrice: 8,
        yearlyPrice: 80,
        regionalConfig: starterRegional,
      },
      {
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 8000,
        yearlyPrice: 80000,
        regionalConfig: {
          ...starterRegional,
          pricePerUser: 8000,
          overagePricePerUser: 6000,
        },
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
        monthlyPrice: 15,
        yearlyPrice: 150,
        regionalConfig: growthRegional,
      },
      {
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 15000,
        yearlyPrice: 150000,
        regionalConfig: {
          ...growthRegional,
          pricePerUser: 15000,
          overagePricePerUser: 12000,
        },
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
        monthlyPrice: 35,
        yearlyPrice: 350,
        regionalConfig: scaleRegional,
      },
      {
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 35000,
        yearlyPrice: 350000,
        regionalConfig: {
          ...scaleRegional,
          pricePerUser: 35000,
          overagePricePerUser: 25000,
        },
      },
    ],
  },
];
