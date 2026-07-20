/** Noah success statuses for payouts and checkout. */
export function isNoahOperationSuccessful(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const s = status.toUpperCase();
  return (
    s === 'SUCCESS' ||
    s === 'COMPLETED' ||
    s === 'SUCCEEDED' ||
    s === 'PAID' ||
    s === 'ACTIVE' ||
    s.includes('PROCESS') ||
    s === 'PENDING'
  );
}

export function isNoahTerminalFailure(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const s = status.toUpperCase();
  return (
    s === 'FAILED' || s === 'CANCELLED' || s === 'CANCELED' || s === 'REJECTED' || s === 'REFUNDED'
  );
}
