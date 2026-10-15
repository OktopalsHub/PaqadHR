/** Payout-rail helpers for the Bachs provider (NGN/USD/EUR/GBP bank + USDT/USDC crypto). */

/** Stablecoins Bachs delivers as a payroll payout destination. */
export type BachsCryptoAsset = 'USDT' | 'USDC';

/** Chains Bachs delivers our stablecoins on. */
export type BachsCryptoNetwork = 'TRC20' | 'BEP20' | 'ERC20' | 'SOL' | 'BASE';

/**
 * Bachs crypto destination currencies we can pay. Bachs publishes USDT on TRC20/BEP20/ERC20/SOL
 * and USDC on BEP20/ERC20/SOL/BASE.
 */
export type BachsCryptoDestinationCurrency =
  | 'USDT_TRC20'
  | 'USDT_BEP20'
  | 'USDT_ERC20'
  | 'USDT_SOL'
  | 'USDC_BEP20'
  | 'USDC_ERC20'
  | 'USDC_SOL'
  | 'USDC_BASE';

/** Stablecoins Bachs pays out. */
export const BACHS_CRYPTO_ASSETS = ['USDT', 'USDC'] as const;

/** Chains Bachs delivers each stablecoin on. */
export const BACHS_CRYPTO_NETWORKS_BY_ASSET: Record<
  BachsCryptoAsset,
  readonly BachsCryptoNetwork[]
> = {
  USDT: ['TRC20', 'BEP20', 'ERC20', 'SOL'],
  USDC: ['BEP20', 'ERC20', 'SOL', 'BASE'],
};

export function isBachsCryptoAsset(currency: string): currency is BachsCryptoAsset {
  return (BACHS_CRYPTO_ASSETS as readonly string[]).includes(currency.toUpperCase());
}

/** Fiat bank currencies Bachs delivers internationally (funded from the USD balance). */
export const BACHS_INTL_BANK_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;

export type BachsIntlBankCurrency = (typeof BACHS_INTL_BANK_CURRENCIES)[number];

export function isBachsIntlBankCurrency(currency: string): currency is BachsIntlBankCurrency {
  return (BACHS_INTL_BANK_CURRENCIES as readonly string[]).includes(currency.toUpperCase());
}

/** International bank routes always debit the USD balance — NGN cannot fund them. */
export const BACHS_INTL_BANK_SOURCE_CURRENCY = 'USD';

/** UK IBAN: GB + check(2) + bank(4) + sort(6) + account(8) = 22 chars. */
export function parseBachsUkIban(
  value: string,
): { iban: string; sortCode: string; accountNumber: string } | null {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^GB\d{2}[A-Z]{4}\d{14}$/.test(iban)) return null;
  return {
    iban,
    sortCode: iban.slice(8, 14),
    accountNumber: iban.slice(14, 22),
  };
}

/**
 * Map a Paqad crypto network label to a Bachs crypto destination currency.
 * Bachs delivers USDT on TRC20/BEP20/ERC20/SOL and USDC on BEP20/ERC20/SOL/BASE.
 * Other networks must stay on Noah/Fincra so funds are never sent to a wallet on the wrong chain.
 *
 * Pass `asset` whenever the caller knows which stablecoin the employee is being paid in.
 * Without it a bare network silently picks a default asset, so `USDT` on Base becomes
 * `USDC_BASE` and the employee is paid a different coin on a different chain than they chose.
 * With it, an asset/chain pair Bachs cannot deliver returns null and the payout fails loudly.
 */
export function mapBachsCryptoDestinationCurrency(
  network?: string | null,
  asset?: string | null,
): BachsCryptoDestinationCurrency | null {
  const raw = (network ?? '').trim();
  if (!raw) return null;

  const requestedAsset = asset?.trim().toUpperCase() || null;
  const lower = raw.toLowerCase().replace(/[\s_-]+/g, '');
  // Accept Bachs' own destination currency codes (USDT_TRC20 / USDT_BEP20, etc.) as input too.
  const parts = raw.toLowerCase().split('_');
  const hasUnderscore = parts.length > 1;
  const [rawAsset, net] = parts;
  const normalizedAsset = rawAsset ? rawAsset.replace(/[\s_-]+/g, '') : lower;
  const normalizedNet = net ? net.replace(/[\s_-]+/g, '') : lower;

  /** Resolve `asset on net`, honouring the caller's asset and Bachs' delivery matrix. */
  const destination = (
    candidateAsset: string,
    candidateNet: string,
  ): BachsCryptoDestinationCurrency | null => {
    const upperAsset = candidateAsset.toUpperCase();
    const upperNet = candidateNet.toUpperCase();
    if (requestedAsset && requestedAsset !== upperAsset) return null;
    if (!BACHS_CRYPTO_NETWORKS_BY_ASSET[upperAsset]?.includes(upperNet)) return null;
    return `${upperAsset}_${upperNet}` as BachsCryptoDestinationCurrency;
  };

  /**
   * Resolve a bare network label. BEP20/ERC20/SOL carry both stablecoins, so honour the
   * caller's asset when given and fall back to the documented default otherwise. The matrix
   * check inside `destination` still rejects pairs Bachs cannot deliver (e.g. USDT on Base).
   */
  const byNetwork = (defaultAsset: string, net: string) =>
    destination(requestedAsset ?? defaultAsset, net);

  // Handle network-only input (e.g., 'TRC20' without asset prefix)
  if (!hasUnderscore) {
    if (lower === 'trc20' || lower === 'tron') return byNetwork('USDT', 'TRC20');
    if (lower === 'bep20' || lower === 'bsc' || lower === 'bnbsmartchain') {
      return byNetwork('USDT', 'BEP20');
    }
    if (lower === 'erc20' || lower === 'ethereum' || lower === 'eth') {
      return byNetwork('USDT', 'ERC20');
    }
    if (lower === 'sol' || lower === 'solana') return byNetwork('USDT', 'SOL');
    if (lower === 'base' || lower === 'basechain') return byNetwork('USDC', 'BASE');
  }

  if (normalizedAsset === 'usdt') {
    if (normalizedNet === 'trc20' || normalizedNet === 'tron') return destination('USDT', 'TRC20');
    if (normalizedNet === 'bep20' || normalizedNet === 'bsc' || normalizedNet === 'bnbsmartchain') {
      return destination('USDT', 'BEP20');
    }
    if (normalizedNet === 'erc20' || normalizedNet === 'ethereum' || normalizedNet === 'eth') {
      return destination('USDT', 'ERC20');
    }
    if (normalizedNet === 'sol' || normalizedNet === 'solana') return destination('USDT', 'SOL');
  }

  if (normalizedAsset === 'usdc') {
    if (normalizedNet === 'bep20' || normalizedNet === 'bsc' || normalizedNet === 'bnbsmartchain') {
      return destination('USDC', 'BEP20');
    }
    if (normalizedNet === 'erc20' || normalizedNet === 'ethereum' || normalizedNet === 'eth') {
      return destination('USDC', 'ERC20');
    }
    if (normalizedNet === 'sol' || normalizedNet === 'solana') return destination('USDC', 'SOL');
    if (normalizedNet === 'base' || normalizedNet === 'basechain')
      return destination('USDC', 'BASE');
  }

  return null;
}

/** Canonical Paqad network labels for the networks Bachs delivers USDT on. */
export const BACHS_USDT_NETWORKS = ['TRC20', 'BEP20', 'ERC20', 'SOL'] as const;

export type BachsUsdtNetwork = (typeof BACHS_USDT_NETWORKS)[number];

/** Canonical Bachs USDT network label for a raw network string, or null when unusable. */
export function normalizeBachsUsdtNetwork(network?: string | null): BachsUsdtNetwork | null {
  const destination = mapBachsCryptoDestinationCurrency(network);
  if (!destination) return null;
  if (destination === 'USDT_TRC20') return 'TRC20';
  if (destination === 'USDT_BEP20') return 'BEP20';
  if (destination === 'USDT_ERC20') return 'ERC20';
  if (destination === 'USDT_SOL') return 'SOL';
  return null;
}

export interface BachsPayoutWebhookEvent {
  eventType: 'payout.paid' | 'payout.failed';
  withdrawalId: string;
  /** The reference Paqad set when creating the payout (the payroll merchant ref), or null. */
  reference: string | null;
  status: string;
  /** Withdrawal amount in the source balance currency (decimal string parsed). */
  amount?: number;
  /** Amount delivered to the destination, in the destination currency. */
  toAmount?: number;
  fromCurrency?: string;
  toCurrency?: string;
}

/** Parse `payout.paid` / `payout.failed` webhook events; returns null for anything else. */
export function parseBachsPayoutWebhook(payload: unknown): BachsPayoutWebhookEvent | null {
  const body = payload as {
    type?: string;
    data?: {
      withdrawal_id?: string;
      reference?: string | null;
      status?: string;
      amount?: string;
      to_amount?: string | null;
      from_currency?: string | null;
      to_currency?: string | null;
    };
  } | null;
  const type = (body?.type ?? '').toLowerCase();
  if (type !== 'payout.paid' && type !== 'payout.failed') return null;
  const withdrawalId = body?.data?.withdrawal_id?.trim();
  if (!withdrawalId) return null;
  const data = body?.data ?? {};
  return {
    eventType: type,
    withdrawalId,
    reference: data.reference?.trim() || null,
    status: (data.status ?? (type === 'payout.paid' ? 'completed' : 'failed')).toLowerCase(),
    amount: parseDecimalString(data.amount),
    toAmount: parseDecimalString(data.to_amount),
    fromCurrency: data.from_currency ?? undefined,
    toCurrency: data.to_currency ?? undefined,
  };
}

/** Bachs money fields are decimal strings at the currency's precision, never minor units. */
function parseDecimalString(value?: string | null): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
