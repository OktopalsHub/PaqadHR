const FINCRA_SUCCESS_STATUSES = new Set(['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID', 'SETTLED']);

const FINCRA_PENDING_STATUSES = new Set(['PENDING', 'PROCESSING', 'IN_PROGRESS']);

export function isFincraOperationSuccessful(status?: string | null): boolean {
  if (!status) return false;
  return FINCRA_SUCCESS_STATUSES.has(status.toUpperCase()) || status.toLowerCase() === 'successful';
}

export function isFincraOperationPending(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return FINCRA_PENDING_STATUSES.has(normalized) || status.toLowerCase() === 'processing';
}

export function normalizeFincraPayoutStatus(status?: string | null): string {
  if (!status) return 'PROCESSING';
  const lower = status.toLowerCase();
  if (lower === 'successful' || lower === 'success') return 'SUCCESS';
  if (lower === 'failed') return 'FAILED';
  if (lower === 'processing') return 'PROCESSING';
  return status.toUpperCase();
}

/** Map fiat currency + country → Fincra paymentScheme for cross-border bank payouts. */
export function resolveFincraFiatPaymentScheme(
  currency: string,
  countryCode?: string | null,
): string | undefined {
  const code = currency.toUpperCase();
  const country = (countryCode ?? defaultFincraBeneficiaryCountry(currency)).toUpperCase();

  if (code === 'GBP' && country === 'GB') return 'fps';
  if (code === 'EUR') return 'sepa';
  if (code === 'USD' && country === 'US') return 'ach';
  if (code === 'USD') return 'swift';
  return undefined;
}

export function resolveFincraPaymentScheme(
  currency: string,
  network?: string | null,
): string | undefined {
  const code = currency.toUpperCase();
  const net = (network ?? '').trim().toLowerCase();

  if (code === 'USDT') {
    if (net.includes('trc') || net === 'tron') return 'usdt_trc20';
    if (net.includes('sol')) return 'usdt_solana';
    if (net.includes('bep') || net.includes('bsc')) return 'usdt_bep20';
    return 'usdt_erc20';
  }
  if (code === 'USDC') {
    if (net.includes('sol')) return 'usdc_solana';
    if (net.includes('bep') || net.includes('bsc')) return 'usdc_bep20';
    return 'usdc_erc20';
  }
  return undefined;
}

const FIAT_COUNTRY: Record<string, string> = {
  NGN: 'NG',
  USD: 'US',
  EUR: 'DE',
  GBP: 'GB',
};

export function defaultFincraBeneficiaryCountry(currency: string): string {
  return FIAT_COUNTRY[currency.toUpperCase()] ?? 'US';
}

/** True when Fincra confirms no payout exists for the customer reference. */
export function isFincraPayoutNotFound(
  httpStatus: number,
  response: { message?: string; error?: string; code?: string },
): boolean {
  if (httpStatus === 404) {
    return true;
  }
  // Server/transient failures must surface as lookup errors, not "absent payout".
  if (httpStatus >= 500) {
    return false;
  }
  const code = (response.code ?? '').toUpperCase();
  if (code === 'RESOURCE_NOT_FOUND') {
    return true;
  }
  const message = `${response.message ?? ''} ${response.error ?? ''}`.trim().toUpperCase();
  return message === 'RESOURCE_NOT_FOUND' || message.includes('PAYOUT NOT FOUND');
}
