export interface SimplePayrollInput {
    memberId: string;
    baseSalary: number;
    currency: string;
    adjustments?: number;
    deductions?: number;
    description?: string;
}
