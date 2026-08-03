export interface EmployeeSettings {
  numberPrefix: string;
  numberPadding: number;
  /** When true, employees must have BVN or NIN on profile before payroll payout. */
  requireIdentityForPayroll?: boolean;
}
