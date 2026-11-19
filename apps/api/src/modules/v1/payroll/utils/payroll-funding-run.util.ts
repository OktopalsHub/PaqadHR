import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';

import type { PayrollRun } from '../entities/payroll-run.entity';
import { resolvePayrollPayoutAmount } from './payroll-payment.util';

export function toIsoDatePart(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function hasConfirmedNombaFeeConfiguration(): boolean {
  const configured = process.env.PAYROLL_PAYOUT_FEE_NOMBA_NGN?.trim();
  return (
    configured !== undefined &&
    configured !== '' &&
    Number.isFinite(Number(configured)) &&
    Number(configured) >= 0
  );
}

export function payableNet(run: PayrollRun): number {
  const items = run.items ?? [];
  if (items.length === 0) {
    return Math.round(Number(run.totalNetAmount ?? 0) * 100) / 100;
  }
  const sum = items
    .filter(
      (item) =>
        item.status === PayrollItemStatus.PENDING || item.status === PayrollItemStatus.FAILED,
    )
    .reduce((acc, item) => acc + Number(item.netAmount ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

export function countPayableTransfers(run: PayrollRun, currency: string): number {
  const currencyCode = currency.toUpperCase();
  return (run.items ?? []).filter(
    (item) =>
      (item.status === PayrollItemStatus.PENDING || item.status === PayrollItemStatus.FAILED) &&
      item.metadata?.excludedFromRun !== true &&
      (item.paymentCurrency || run.baseCurrency).toUpperCase() === currencyCode &&
      Number(resolvePayrollPayoutAmount(item)) > 0,
  ).length;
}

export function providerDisplayName(provider: PaymentProvider): string {
  switch (provider) {
    case PaymentProvider.NOMBA:
      return 'Nomba';
    case PaymentProvider.BRIDGE:
      return 'Bridge';
    default:
      return 'the payment provider';
  }
}
