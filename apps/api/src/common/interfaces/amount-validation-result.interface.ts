export interface AmountValidationResult {
    isValid: boolean;
    formattedAmount: number;
    errors: string[];
    warnings: string[];
}
