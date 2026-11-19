export const SUCCESSFUL_CHECKOUT_STATUSES = new Set([
  'success',
  'successful',
  'succeeded',
  'accepted',
]);

/** A float top-up checkout stays claimable for this long; after it, a new one may be opened. */
export const FLOAT_TOPUP_PENDING_TTL_MS = 60 * 60 * 1000;

/** Window in which a checkout whose creation call has not returned is still being created. */
export const FLOAT_TOPUP_CREATION_IN_FLIGHT_MS = 180 * 1000;
