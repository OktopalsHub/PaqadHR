export interface SimplePayrollResult {
    grossAmount: number;
    adjustments: number;
    deductions: number;
    netAmount: number;
    currency: string;
    description: string;
}
