import { Injectable } from '@nestjs/common';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';

@Injectable()
export class PayrollFeeService {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}
  async getPayrollFeePercentage(tenantId: string): Promise<number> {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const fromPrice = subscription?.planPrice?.regionalConfig?.payrollFeePercentage;
    if (fromPrice != null) return Number(fromPrice);
    return 3;
  }
  async calculatePayrollFee(params: {
    totalPayrollAmount: number;
    currency: string;
    tenantId: string;
  }) {
    const feePercentage = await this.getPayrollFeePercentage(params.tenantId);
    const platformFee = Math.round(params.totalPayrollAmount * (feePercentage / 100) * 100) / 100;
    return {
      originalAmount: params.totalPayrollAmount,
      currency: params.currency,
      platformFee,
      totalAmountToCharge: params.totalPayrollAmount + platformFee,
      feePercentage,
      breakdown: {
        employeePayments: params.totalPayrollAmount,
        platformFee,
      },
    };
  }
  async previewPayrollFees(
    payrollItems: Array<{ amount: number; currency: string }>,
    tenantId: string,
  ) {
    const byCurrency: Array<{
      originalAmount: number;
      currency: string;
      platformFee: number;
      totalAmountToCharge: number;
      feePercentage: number;
      breakdown: { employeePayments: number; platformFee: number };
    }> = [];
    const totals: Record<string, { original: number; fee: number; charge: number }> = {};
    for (const item of payrollItems) {
      const calc = await this.calculatePayrollFee({
        totalPayrollAmount: item.amount,
        currency: item.currency,
        tenantId,
      });
      if (!totals[item.currency]) {
        totals[item.currency] = { original: 0, fee: 0, charge: 0 };
      }
      totals[item.currency].original += calc.originalAmount;
      totals[item.currency].fee += calc.platformFee;
      totals[item.currency].charge += calc.totalAmountToCharge;
      byCurrency.push({
        originalAmount: calc.originalAmount,
        currency: calc.currency,
        platformFee: calc.platformFee,
        totalAmountToCharge: calc.totalAmountToCharge,
        feePercentage: calc.feePercentage,
        breakdown: calc.breakdown,
      });
    }
    const totalOriginalAmount: Record<string, number> = {};
    const totalPlatformFees: Record<string, number> = {};
    const totalChargeAmount: Record<string, number> = {};
    for (const [currency, value] of Object.entries(totals)) {
      totalOriginalAmount[currency] = value.original;
      totalPlatformFees[currency] = value.fee;
      totalChargeAmount[currency] = value.charge;
    }
    return { totalOriginalAmount, totalPlatformFees, totalChargeAmount, byCurrency };
  }
}
