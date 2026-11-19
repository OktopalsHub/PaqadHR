import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { getPayrollPayoutFeePerTransfer } from '../../../../common/config/payroll-payout-fee.util';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import {
  addMoneyAmounts,
  calculatePayrollPlatformFee,
  sumMoneyAmounts,
} from '../utils/payroll-platform-fee.util';

@Injectable()
export class PayrollFeeService {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async getPayrollFeePercentage(tenantId: string): Promise<number> {
    const subscription = await this.subscriptionsService.getTenantSubscription(tenantId);
    const fromPrice = subscription?.planPrice?.regionalConfig?.payrollFeePercentage;
    const feePercentage = fromPrice == null ? 3 : Number(fromPrice);
    if (!Number.isFinite(feePercentage) || feePercentage < 0 || feePercentage > 100) {
      throw new ServiceUnavailableException('The payroll fee on the active plan is invalid.');
    }
    return feePercentage;
  }

  async calculatePayrollFee(params: {
    totalPayrollAmount: number;
    currency: string;
    tenantId: string;
    provider?: string;
    transferCount?: number;
  }) {
    const feePercentage = await this.getPayrollFeePercentage(params.tenantId);
    const transferCount = Math.max(1, Math.floor(params.transferCount ?? 1));
    return this.calculateForAmount(
      params.totalPayrollAmount,
      params.currency,
      feePercentage,
      transferCount,
    );
  }

  async previewPayrollFees(
    payrollItems: Array<{ amount: number; currency: string }>,
    tenantId: string,
  ) {
    const feePercentage = await this.getPayrollFeePercentage(tenantId);
    const byCurrency = payrollItems.map((item) =>
      this.calculateForAmount(item.amount, item.currency, feePercentage, 1),
    );
    const currencyTotals = new Map<
      string,
      {
        original: string[];
        fee: string[];
        providerReserve: string[];
        nombaTransferCharge: string[];
        charge: string[];
      }
    >();

    for (let index = 0; index < payrollItems.length; index += 1) {
      const item = payrollItems[index];
      const calculation = byCurrency[index];
      const original = this.moneyString(item.amount);
      const currency = item.currency.toUpperCase();
      const totals = currencyTotals.get(currency) ?? {
        original: [],
        fee: [],
        providerReserve: [],
        nombaTransferCharge: [],
        charge: [],
      };
      totals.original.push(original);
      totals.fee.push(this.moneyString(calculation.platformFee));
      totals.providerReserve.push(this.moneyString(calculation.payoutFeeReserve));
      totals.nombaTransferCharge.push(this.moneyString(calculation.nombaTransferCharge));
      totals.charge.push(this.moneyString(calculation.totalAmountToCharge));
      currencyTotals.set(currency, totals);
    }

    const totalOriginalAmount: Record<string, number> = {};
    const totalPlatformFees: Record<string, number> = {};
    const totalPayoutFeeReserves: Record<string, number> = {};
    const totalNombaTransferCharges: Record<string, number> = {};
    const totalChargeAmount: Record<string, number> = {};
    for (const [currency, totals] of currencyTotals) {
      totalOriginalAmount[currency] = this.moneyNumber(sumMoneyAmounts(totals.original));
      totalPlatformFees[currency] = this.moneyNumber(sumMoneyAmounts(totals.fee));
      totalPayoutFeeReserves[currency] = this.moneyNumber(sumMoneyAmounts(totals.providerReserve));
      totalNombaTransferCharges[currency] = this.moneyNumber(
        sumMoneyAmounts(totals.nombaTransferCharge),
      );
      totalChargeAmount[currency] = this.moneyNumber(sumMoneyAmounts(totals.charge));
    }

    return {
      totalOriginalAmount,
      totalPlatformFees,
      totalPayoutFeeReserves,
      totalNombaTransferCharges,
      totalChargeAmount,
      byCurrency,
    };
  }

  private calculateForAmount(
    amount: number,
    currency: string,
    feePercentage: number,
    transferCount: number,
  ) {
    const originalAmount = this.moneyString(amount);
    const platformFee = calculatePayrollPlatformFee(originalAmount, feePercentage);
    const currencyCode = currency.toUpperCase();
    const payoutFeePerTransfer = ['USD', 'EUR', 'GBP'].includes(currencyCode)
      ? calculatePayrollPlatformFee(originalAmount, 1)
      : currencyCode === 'NGN'
        ? this.moneyString(getPayrollPayoutFeePerTransfer('NGN', 'nomba'))
        : '0';
    const nombaTransferChargePerTransfer =
      currencyCode === 'NGN' ? this.moneyString(this.getNombaTransferCharge()) : '0';
    const payoutFeeReserve = this.moneyString(Number(payoutFeePerTransfer) * transferCount);
    const nombaTransferCharge = this.moneyString(
      Number(nombaTransferChargePerTransfer) * transferCount,
    );
    const totalAmountBeforeProviderReserve =
      platformFee && addMoneyAmounts(originalAmount, platformFee);
    const totalAmountBeforeReserves =
      totalAmountBeforeProviderReserve &&
      payoutFeeReserve &&
      addMoneyAmounts(totalAmountBeforeProviderReserve, payoutFeeReserve);
    const totalAmountToCharge =
      totalAmountBeforeReserves && addMoneyAmounts(totalAmountBeforeReserves, nombaTransferCharge);
    if (!platformFee || !totalAmountToCharge) {
      throw new ServiceUnavailableException(
        'The payroll fee amount could not be calculated safely.',
      );
    }

    return {
      originalAmount: this.moneyNumber(originalAmount),
      currency,
      platformFee: this.moneyNumber(platformFee),
      payoutFeePerTransfer: this.moneyNumber(payoutFeePerTransfer),
      payoutFeeReserve: this.moneyNumber(payoutFeeReserve),
      nombaTransferChargePerTransfer: this.moneyNumber(nombaTransferChargePerTransfer),
      nombaTransferCharge: this.moneyNumber(nombaTransferCharge),
      payoutTransferCount: transferCount,
      totalAmountToCharge: this.moneyNumber(totalAmountToCharge),
      feePercentage,
      providerFeeQuoteAvailable: false,
      providerFeeNote:
        currencyCode === 'NGN'
          ? 'NGN reserves Nomba’s bank-transfer fee separately from PaqadHR’s ₦50 per-transfer markup. The indicative Nomba reserve is up to ₦50 plus VAT (₦53.75); confirm your account tariff and set PAYROLL_PAYOUT_FEE_NOMBA_NGN before enabling payouts. Nomba checkout card pricing is 1.0–1.4% capped at ₦1,800 for local NGN cards and 3.8% for international cards; checkout processing fees are separate and not included in this payout estimate.'
          : 'Bank payouts include a 1% estimated Bridge fixed-output funding buffer; FX and provider costs can vary and are confirmed on the transfer receipt.',
      breakdown: {
        employeePayments: this.moneyNumber(originalAmount),
        platformFee: this.moneyNumber(platformFee),
        payoutFeeReserve: this.moneyNumber(payoutFeeReserve),
        nombaTransferCharge: this.moneyNumber(nombaTransferCharge),
      },
    };
  }

  private getNombaTransferCharge(): number {
    const configured = Number(process.env.PAYROLL_NOMBA_TRANSFER_CHARGE_NGN ?? '50');
    if (!Number.isFinite(configured) || configured < 0) {
      throw new ServiceUnavailableException('The Nomba transfer charge configuration is invalid.');
    }
    return Math.round(configured * 100) / 100;
  }

  private moneyString(amount: number): string {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ServiceUnavailableException('Payroll amount is not a valid decimal.');
    }
    const value = amount.toString();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value)) {
      throw new ServiceUnavailableException('Payroll amount precision is not supported.');
    }
    return value;
  }

  private moneyNumber(amount: string | null): number {
    if (amount === null) {
      throw new ServiceUnavailableException('Payroll fee totals could not be calculated safely.');
    }
    return Number(amount);
  }
}
