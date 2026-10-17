import { Injectable } from '@nestjs/common';
import { getPayrollPayoutFeePerTransfer } from '../../../../common/config/payroll-payout-fee.util';
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
    provider?: string;
    transferCount?: number;
  }) {
    const feePercentage = await this.getPayrollFeePercentage(params.tenantId);
    const platformFee =
      Math.round(params.totalPayrollAmount * (feePercentage / 100) * 100) / 100;
    const payoutFeePerTransfer = getPayrollPayoutFeePerTransfer(params.currency, params.provider);
    const payoutTransferCount = Math.max(1, Math.floor(params.transferCount ?? 1));
    const payoutFeeReserve = Math.round(payoutFeePerTransfer * payoutTransferCount * 100) / 100;
    return {
      originalAmount: params.totalPayrollAmount,
      currency: params.currency,
      platformFee,
      payoutFeePerTransfer,
      payoutFeeReserve,
      payoutTransferCount,
      totalAmountToCharge:
        Math.round((params.totalPayrollAmount + platformFee + payoutFeeReserve) * 100) / 100,
      feePercentage,
      breakdown: {
        employeePayments: params.totalPayrollAmount,
        platformFee,
        payoutFeeReserve,
      },
    };
  }
  async previewPayrollFees(
    payrollItems: Array<{ amount: number; currency: string; provider?: string }>,
    tenantId: string,
  ) {
    const byCurrency: Array<{
      originalAmount: number;
      currency: string;
      platformFee: number;
      totalAmountToCharge: number;
      feePercentage: number;
      payoutFeePerTransfer: number;
      payoutFeeReserve: number;
      payoutTransferCount: number;
      breakdown: {
        employeePayments: number;
        platformFee: number;
        payoutFeeReserve: number;
      };
    }> = [];
    const totals: Record<
      string,
      { original: number; fee: number; payoutFeeReserve: number; charge: number }
    > = {};
    for (const item of payrollItems) {
      const calc = await this.calculatePayrollFee({
        totalPayrollAmount: item.amount,
        currency: item.currency,
        tenantId,
        provider: item.provider,
        transferCount: 1,
      });
      if (!totals[item.currency]) {
        totals[item.currency] = { original: 0, fee: 0, payoutFeeReserve: 0, charge: 0 };
      }
      totals[item.currency].original += calc.originalAmount;
      totals[item.currency].fee += calc.platformFee;
      totals[item.currency].payoutFeeReserve += calc.payoutFeeReserve;
      totals[item.currency].charge += calc.totalAmountToCharge;
      byCurrency.push({
        originalAmount: calc.originalAmount,
        currency: calc.currency,
        platformFee: calc.platformFee,
        totalAmountToCharge: calc.totalAmountToCharge,
        feePercentage: calc.feePercentage,
        payoutFeePerTransfer: calc.payoutFeePerTransfer,
        payoutFeeReserve: calc.payoutFeeReserve,
        payoutTransferCount: calc.payoutTransferCount,
        breakdown: calc.breakdown,
      });
    }
    const totalOriginalAmount: Record<string, number> = {};
    const totalPlatformFees: Record<string, number> = {};
    const totalPayoutFeeReserves: Record<string, number> = {};
    const totalChargeAmount: Record<string, number> = {};
    for (const [currency, value] of Object.entries(totals)) {
      totalOriginalAmount[currency] = value.original;
      totalPlatformFees[currency] = value.fee;
      totalPayoutFeeReserves[currency] = value.payoutFeeReserve;
      totalChargeAmount[currency] = value.charge;
    }
    return {
      totalOriginalAmount,
      totalPlatformFees,
      totalPayoutFeeReserves,
      totalChargeAmount,
      byCurrency,
    };
  }
}
