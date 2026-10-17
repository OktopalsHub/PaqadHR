/**
 * Payroll payout fee reserves are separate from PaqadHR's percentage-based platform fee.
 *
 * Provider-specific values can be configured with PAYROLL_PAYOUT_FEE_<PROVIDER>_<CURRENCY>.
 * Currency defaults can be set with PAYROLL_PAYOUT_FEE_<CURRENCY>. NGN defaults to ₦100
 * per payout to cover rails that currently charge around ₦50 per transfer.
 *
 * Provider is intentionally a string rather than PaymentProvider so future payout adapters
 * (for example Paystack) can use this configuration without changing the fee utility.
 */
export const DEFAULT_NGN_PAYOUT_FEE_RESERVE = 100;

type Environment = Record<string, string | undefined>;

function parseNonNegativeAmount(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function getPayrollPayoutFeePerTransfer(
  currency: string,
  provider?: string | null,
  env: Environment = process.env,
): number {
  const currencyCode = currency.trim().toUpperCase();
  const providerCode = provider
    ?.trim()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase();
  const providerAmount = providerCode
    ? parseNonNegativeAmount(env[`PAYROLL_PAYOUT_FEE_${providerCode}_${currencyCode}`])
    : null;
  if (providerAmount != null) return providerAmount;

  const currencyAmount = parseNonNegativeAmount(env[`PAYROLL_PAYOUT_FEE_${currencyCode}`]);
  if (currencyAmount != null) return currencyAmount;

  return currencyCode === 'NGN' ? DEFAULT_NGN_PAYOUT_FEE_RESERVE : 0;
}

export function calculatePayrollPayoutFeeReserve(params: {
  currency: string;
  transferCount: number;
  provider?: string | null;
  env?: Environment;
}): { feePerTransfer: number; transferCount: number; total: number } {
  const transferCount = Math.max(0, Math.floor(params.transferCount));
  const feePerTransfer = getPayrollPayoutFeePerTransfer(
    params.currency,
    params.provider,
    params.env,
  );
  return {
    feePerTransfer,
    transferCount,
    total: Math.round(feePerTransfer * transferCount * 100) / 100,
  };
}
