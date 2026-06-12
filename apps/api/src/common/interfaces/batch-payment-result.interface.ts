import { PaymentResult } from "./payment-result.interface";

export interface BatchPaymentResult {
    totalItems: number;
    successfulPayments: number;
    failedPayments: number;
    fiatResults: PaymentResult[];
    summary: {
        fiatSuccess: number;
        fiatFailed: number;
        };
}
