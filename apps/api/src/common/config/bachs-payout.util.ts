/** Payout-rail helpers for the Bachs provider (NGN bank + USDT crypto payouts). */

export type BachsCryptoDestinationCurrency = 'USDT_TRC20' | 'USDT_BEP20';

/**
 * Map a Paqad crypto network label to a Bachs crypto destination currency.
 * Bachs only delivers USDT on TRC20 and BEP20 — other networks (e.g. Ethereum)
 * must stay on Noah/Fincra so funds are never sent to a wallet on the wrong chain.
 */
export function mapBachsCryptoDestinationCurrency(
  network?: string | null,
): BachsCryptoDestinationCurrency | null {
  const raw = (network ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  // Accept Bachs' own destination currency codes (USDT_TRC20 / USDT_BEP20) as input too.
  const normalized = raw.startsWith('usdt') ? raw.slice(4) : raw;
  if (normalized === 'trc20' || normalized === 'tron') return 'USDT_TRC20';
  if (normalized === 'bep20' || normalized === 'bsc' || normalized === 'bnbsmartchain') {
    return 'USDT_BEP20';
  }
  return null;
}

/** Canonical Paqad network labels for the networks Bachs delivers USDT on. */
export const BACHS_USDT_NETWORKS = ['TRC20', 'BEP20'] as const;

export type BachsUsdtNetwork = (typeof BACHS_USDT_NETWORKS)[number];

/** Canonical Bachs USDT network label for a raw network string, or null when unusable. */
export function normalizeBachsUsdtNetwork(network?: string | null): BachsUsdtNetwork | null {
  const destination = mapBachsCryptoDestinationCurrency(network);
  if (!destination) return null;
  return destination === 'USDT_TRC20' ? 'TRC20' : 'BEP20';
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
