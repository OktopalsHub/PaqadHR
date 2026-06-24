export interface PointsSettings {
  monthlyAllowance: number;
  allowancePeriod?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  maxPointsPerShoutout: number;
  minPointsPerShoutout: number;
  autoAssignPoints: boolean;
  autoAssignAmount: number;
  startingBalance: number;
  dailyLimit: number;
  monthlyLimit: number;
}
