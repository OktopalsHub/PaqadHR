/**
 * Lightweight self-check for NGN bank fallback + lookup-down detection.
 * Run: npx tsx apps/api/src/common/constants/nigerian-banks.check.ts
 */
import { NIGERIAN_BANKS_FALLBACK } from './nigerian-banks.constant';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(NIGERIAN_BANKS_FALLBACK.length >= 10, 'fallback bank list too small');
assert(
  NIGERIAN_BANKS_FALLBACK.every((bank) => /^\d+$/.test(bank.code) && bank.name.trim().length > 0),
  'fallback banks must have numeric codes and names',
);
assert(
  NIGERIAN_BANKS_FALLBACK.some((bank) => bank.code === '058'),
  'GTBank (058) missing from fallback',
);

function lookupDownMessage(message: string): boolean {
  return /not available|not configured|unavailable|Failed to authenticate with Nomba/i.test(
    message,
  );
}

assert(lookupDownMessage('Bank lookup is not available in this environment'), '503 copy');
assert(lookupDownMessage('Failed to authenticate with Nomba (401)'), 'auth failure');
assert(
  !lookupDownMessage('Could not verify this bank account'),
  'invalid account must stay hard fail',
);
