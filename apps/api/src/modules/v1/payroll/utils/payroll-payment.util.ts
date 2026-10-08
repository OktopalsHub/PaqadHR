import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import type { CreatePaymentData } from 'src/common/interfaces/create-payment-data.interface';
import type { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import type { PayrollItem } from '../entities/payroll-item.entity';

import { buildPayrollMerchantRef } from './payroll-merchant-ref.util';

/** Prefer paymentAmount; for FX-at-payout rows use salary net until provider quotes. */
export function resolvePayrollPayoutAmount(item: PayrollItem): number {
  const meta = item.metadata ?? {};
  if (meta.fxAtPayout === true) {
    const net = Number(item.netAmount);
    if (Number.isFinite(net) && net > 0) return net;
  }
  const payment = Number(item.paymentAmount);
  if (Number.isFinite(payment) && payment > 0) {
    return payment;
  }
  const net = Number(item.netAmount);
  if (Number.isFinite(net) && net > 0) {
    return net;
  }
  return 0;
}

function readStoredBachsBankAddress(
  metadata: Record<string, unknown>,
): Record<string, string> | undefined {
  const raw = metadata.bachsBankAddress;
  if (!raw || typeof raw !== 'object') return undefined;
  const addr = raw as Record<string, unknown>;
  const line1 = typeof addr.line1 === 'string' ? addr.line1.trim() : '';
  const city = typeof addr.city === 'string' ? addr.city.trim() : '';
  const state = typeof addr.state === 'string' ? addr.state.trim() : '';
  const postalCode =
    typeof addr.postalCode === 'string'
      ? addr.postalCode.trim()
      : typeof addr.postal_code === 'string'
        ? addr.postal_code.trim()
        : '';
  const countryRaw =
    typeof addr.country === 'string'
      ? addr.country
      : typeof addr.countryCode === 'string'
        ? addr.countryCode
        : '';
  const country = countryRaw.trim().toUpperCase();
  if (!line1 || !city || !state || !postalCode || !country) return undefined;
  return { line1, city, state, postalCode, country };
}

/**
 * USD Bachs destinations need a US bank address. Prefer a saved US `bachsBankAddress`;
 * otherwise use a US employee home address. Non-US saved addresses are ignored so they
 * cannot override a valid US home address (readiness and payout must agree).
 */
export function resolveBachsUsdBankAddress(
  metadata: Record<string, unknown> | null | undefined,
  homeAddress?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null,
): Record<string, string> | undefined {
  const stored = readStoredBachsBankAddress(metadata ?? {});
  if (stored?.country === 'US') return stored;
  if (
    homeAddress?.street?.trim() &&
    homeAddress.city?.trim() &&
    homeAddress.state?.trim() &&
    homeAddress.postalCode?.trim() &&
    homeAddress.country?.trim().toUpperCase() === 'US'
  ) {
    return {
      line1: homeAddress.street.trim(),
      city: homeAddress.city.trim(),
      state: homeAddress.state.trim(),
      postalCode: homeAddress.postalCode.trim(),
      country: 'US',
    };
  }
  return undefined;
}

/** Build provider-neutral payout data from a payroll item and its payment method. */
export function buildPayrollPaymentData(
  item: PayrollItem,
  paymentMethod: PaymentMethod,
  employeeName: string,
  tenantName?: string,
  payrollRunTitle?: string,
  options?: { bachsSourceCurrency?: string },
): CreatePaymentData {
  const meta = paymentMethod.metadata ?? {};
  const baseDescription = payrollRunTitle
    ? `${payrollRunTitle} for ${employeeName}`
    : `Payroll payment for ${employeeName}`;
  const currency = item.paymentCurrency;
  const isCrypto = paymentMethod.type === PaymentMethodType.CRYPTO || isCryptoCurrency(currency);
  const fxAtPayout = item.metadata?.fxAtPayout === true;
  const salaryCurrency = item.baseSalaryCurrency?.toUpperCase();
  const address = paymentMethod.member?.address;
  const canonicalHolderAddress =
    address?.street && address.city && address.state && address.postalCode && address.country
      ? {
          line1: address.street,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          countryCode: address.country.toUpperCase(),
        }
      : undefined;
  const bachsBankAddress = resolveBachsUsdBankAddress(meta, address);
  const retryAttempt =
    typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
  const bachsSourceCurrency = options?.bachsSourceCurrency?.trim().toUpperCase() || undefined;

  return {
    amount: resolvePayrollPayoutAmount(item),
    currency,
    description: item.description ?? baseDescription,
    accountNumber: isCrypto
      ? ((meta.walletAddress as string | undefined) ?? paymentMethod.accountNumber ?? undefined)
      : (paymentMethod.accountNumber ?? undefined),
    accountName: paymentMethod.accountName ?? undefined,
    bankCode: paymentMethod.bankCode ?? undefined,
    bankName: paymentMethod.bankName ?? undefined,
    countryCode: paymentMethod.country ?? undefined,
    network: isCrypto ? ((meta.cryptoNetwork as string | undefined) ?? undefined) : undefined,
    senderName: formatNombaSenderName(tenantName),
    merchantTxRef: buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt),
    paymentRail: typeof meta.nombaPaymentMethod === 'string' ? meta.nombaPaymentMethod : undefined,
    institutionCode:
      typeof meta.institutionCode === 'string'
        ? meta.institutionCode
        : (paymentMethod.bankCode ?? undefined),
    institutionName:
      typeof meta.institutionName === 'string'
        ? meta.institutionName
        : (paymentMethod.bankName ?? undefined),
    accountType: meta.accountType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL',
    bankAccountType: meta.bankAccountType === 'SAVINGS' ? 'SAVINGS' : 'CHECKING',
    purposeOfPayment: typeof meta.purposeOfPayment === 'string' ? meta.purposeOfPayment : 'PAYROLL',
    metadata: {
      payrollRunId: item.payrollRunId,
      payrollItemId: item.id,
      memberId: item.memberId,
      paymentMethodId: paymentMethod.id,
      walletAddress: meta.walletAddress,
      cryptoNetwork: meta.cryptoNetwork,
      noahChannelId: meta.noahChannelId,
      noahHolderAddress: canonicalHolderAddress,
      bachsBankAddress,
      bachsDestinationId:
        typeof meta.bachsDestinationId === 'string' ? meta.bachsDestinationId : undefined,
      bachsSourceCurrency,
      tenantName,
      fxAtPayout,
      salaryCurrency,
      salaryNetAmount: fxAtPayout ? Number(item.netAmount) : undefined,
    },
  };
}
