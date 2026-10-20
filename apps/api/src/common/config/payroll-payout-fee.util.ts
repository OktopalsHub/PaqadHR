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

/**
 * Bachs charges its withdrawal fee in the currency the balance is debited in, on top of the
 * amount the recipient receives (see https://docs.bachs.io/for-you/fees). A quote's
 * `from_amount` is the source amount *before* that fee, so a checkout sized from the quote
 * alone under-funds the payout by one fee per employee — the last payout then fails.
 *
 * PaqadHR reserves the provider fee per payout plus a small markup (default 10%) that stays with
 * PaqadHR. NGN is a flat ₦50 → ₦55. Set PAYROLL_PAYOUT_FEE_MARKUP_PERCENT to change the markup.
 */
const BACHS_NGN_WITHDRAWAL_FEE = 50;
const BACHS_USD_WITHDRAWAL_RATE = 0.01;
const BACHS_USD_WITHDRAWAL_MIN = 1;
const BACHS_USD_WITHDRAWAL_CAP = 15;
const BACHS_OTHER_WITHDRAWAL_RATE = 0.003;

export const DEFAULT_PAYROLL_PAYOUT_FEE_MARKUP_PERCENT = 10;

type Environment = Record<string, string | undefined>;

function parseNonNegativeAmount(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** How much PaqadHR adds on top of the provider's transfer charge (default 10%). */
export function getPayrollPayoutFeeMarkupPercent(env: Environment = process.env): number {
  return (
    parseNonNegativeAmount(env.PAYROLL_PAYOUT_FEE_MARKUP_PERCENT) ??
    DEFAULT_PAYROLL_PAYOUT_FEE_MARKUP_PERCENT
  );
}

/**
 * Bachs' own withdrawal fee for a single payout, denominated in the currency the balance is
 * debited in. Percentage fees are priced from the source amount that leaves the balance.
 */
export function getBachsWithdrawalFeePerTransfer(
  sourceAmount: number,
  sourceCurrency: string,
): number {
  const code = sourceCurrency.trim().toUpperCase();
  const amount = Number.isFinite(sourceAmount) && sourceAmount > 0 ? sourceAmount : 0;
  if (code === 'NGN') return BACHS_NGN_WITHDRAWAL_FEE;
  if (code === 'USD') {
    return round2(
      Math.min(
        BACHS_USD_WITHDRAWAL_CAP,
        Math.max(BACHS_USD_WITHDRAWAL_MIN, amount * BACHS_USD_WITHDRAWAL_RATE),
      ),
    );
  }
  if (code === 'USDT' || code === 'USDC') {
    return round2(Math.max(1, amount * BACHS_USD_WITHDRAWAL_RATE));
  }
  return round2(amount * BACHS_OTHER_WITHDRAWAL_RATE);
}

/**
 * The per-payout reserve PaqadHR adds to a checkout or retry allocation.
 *
 * An explicit provider/currency env override still wins (operators may have negotiated a
 * different rate). Otherwise Bachs payouts are reserved from Bachs' published schedule plus the
 * configured markup, which requires the source amount leaving the balance. The currency-only
 * override (PAYROLL_PAYOUT_FEE_<CURRENCY>) applies to non-Bachs rails only, so a legacy NGN
 * reserve can never override the fee Bachs actually charges. Non-Bachs rails keep the flat
 * currency default.
 */
export function resolvePayrollPayoutFeePerTransfer(params: {
  currency: string;
  provider?: string | null;
  sourceAmount?: number;
  env?: Environment;
}): number {
  const env = params.env ?? process.env;
  const currency = params.currency.trim().toUpperCase();
  const providerLabel = (params.provider ?? '').trim().toLowerCase();
  if (providerLabel.includes('bachs')) {
    const override = getProviderPayrollPayoutFeeOverride(currency, params.provider, env);
    if (override != null) return override;
    const sourceAmount = params.sourceAmount ?? 0;
    const providerFee = getBachsWithdrawalFeePerTransfer(sourceAmount, currency);
    const markup = getPayrollPayoutFeeMarkupPercent(env);
    return round2(providerFee * (1 + markup / 100));
  }

  const configured = getConfiguredPayrollPayoutFeePerTransfer(currency, params.provider, env);
  if (configured != null) return configured;

  return currency === 'NGN' ? DEFAULT_NGN_PAYOUT_FEE_RESERVE : 0;
}

/** Provider+currency override only (PAYROLL_PAYOUT_FEE_<PROVIDER>_<CURRENCY>). */
function getProviderPayrollPayoutFeeOverride(
  currency: string,
  provider: string | null | undefined,
  env: Environment,
): number | null {
  const providerCode = provider
    ?.trim()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase();
  if (!providerCode) return null;
  return parseNonNegativeAmount(env[`PAYROLL_PAYOUT_FEE_${providerCode}_${currency}`]);
}

/** Explicit env override for a provider+currency or currency, or null when unset. */
function getConfiguredPayrollPayoutFeePerTransfer(
  currency: string,
  provider: string | null | undefined,
  env: Environment,
): number | null {
  const providerAmount = getProviderPayrollPayoutFeeOverride(currency, provider, env);
  if (providerAmount != null) return providerAmount;
  return parseNonNegativeAmount(env[`PAYROLL_PAYOUT_FEE_${currency}`]);
}

export function getPayrollPayoutFeePerTransfer(
  currency: string,
  provider?: string | null,
  env: Environment = process.env,
): number {
  const currencyCode = currency.trim().toUpperCase();
  const configured = getConfiguredPayrollPayoutFeePerTransfer(currencyCode, provider, env);
  if (configured != null) return configured;

  return currencyCode === 'NGN' ? DEFAULT_NGN_PAYOUT_FEE_RESERVE : 0;
}

/** True when a currency or provider-specific payout fee was explicitly configured. */
export function hasConfiguredPayrollPayoutFee(
  currency: string,
  provider?: string | null,
  env: Environment = process.env,
): boolean {
  return (
    getConfiguredPayrollPayoutFeePerTransfer(currency.trim().toUpperCase(), provider, env) != null
  );
}

export function calculatePayrollPayoutFeeReserve(params: {
  currency: string;
  transferCount: number;
  provider?: string | null;
  env?: Environment;
  /** Source amount debited per payout; required to price percentage-based Bachs fees. */
  sourceAmountPerTransfer?: number;
}): { feePerTransfer: number; transferCount: number; total: number } {
  const transferCount = Math.max(0, Math.floor(params.transferCount));
  const feePerTransfer = resolvePayrollPayoutFeePerTransfer({
    currency: params.currency,
    provider: params.provider,
    sourceAmount: params.sourceAmountPerTransfer,
    env: params.env,
  });
  return {
    feePerTransfer,
    transferCount,
    // Match previews: round each transfer's reserve to the currency's minor unit first.
    total: (Math.round(feePerTransfer * 100) / 100) * transferCount,
  };
}
