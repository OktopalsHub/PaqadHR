/**
 * Shown to members when Tremendous cannot fund a reward order.
 * The member cannot fix the provider-side balance, so route them to support
 * instead of surfacing the raw provider error.
 */
export const TREMENDOUS_SUPPORT_MESSAGE =
  'This reward could not be fulfilled right now. Please contact info@paqadhr.com for assistance.';

/** Matches the "not enough money in the funding source" family of Tremendous errors. */
const INSUFFICIENT_FUNDS_PATTERN =
  /insufficient\s+(?:funds?|balance|credit)|not\s+(?:have\s+)?enough\s+(?:funds?|balance|credit)|(?:funding\s+source|wallet|account|balance)[^.]{0,60}(?:insufficient|not\s+enough|too\s+low|empty|zero)|(?:balance|credit|funds?)\s+is\s+(?:too\s+low|empty|zero)|exceeds?[^.]{0,40}(?:balance|funds?|limit)/i;

/** True only when Tremendous rejected an order because its funding source has no money left. */
export function isTremendousInsufficientFundsError(message: string | undefined | null): boolean {
  return INSUFFICIENT_FUNDS_PATTERN.test(message ?? '');
}
