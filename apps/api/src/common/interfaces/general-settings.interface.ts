export interface GeneralSettings {
  timezone: string;
  dateFormat: string;
  currency: string;
  /** Currencies members may use for payroll bank accounts. Falls back to `currency` when unset. */
  payrollCurrencies?: string[];
  language: string;
  companyName: string;
  paginationLimit?: number;
  /** When true, publishing payslips sends email notifications by default. */
  emailPayslipOnPublish?: boolean;
}
