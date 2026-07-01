export const MEMBER_WALLET_UNAVAILABLE =
  'Please contact your office administrator.';

const WALLET_CHARGE_PATTERN =
  /wallet|charge|payment|billing|top.?up|fund|unavailable|insufficient/i;

export function mapMemberWalletError(err: unknown, fallback: string): string {
  const msg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (WALLET_CHARGE_PATTERN.test(msg)) {
    return MEMBER_WALLET_UNAVAILABLE;
  }
  return msg || fallback;
}
