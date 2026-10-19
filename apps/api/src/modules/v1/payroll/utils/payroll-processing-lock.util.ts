export const PAYROLL_PROCESSING_LOCK_MS = 30 * 60 * 1000;

export function hasActivePayrollProcessingLock(
  lockedAt: Date | null | undefined,
  now = Date.now(),
): boolean {
  return lockedAt instanceof Date && lockedAt.getTime() > now - PAYROLL_PROCESSING_LOCK_MS;
}
