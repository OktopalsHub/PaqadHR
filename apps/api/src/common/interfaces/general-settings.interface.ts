export interface GeneralSettings {
  timezone: string;
  dateFormat: string;
  currency: string;
  
  payrollCurrencies?: string[];
  language: string;
  companyName: string;
  paginationLimit?: number;
  
  emailPayslipOnPublish?: boolean;
}
