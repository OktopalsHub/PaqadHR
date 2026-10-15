import { LeaveStatus } from 'src/common/enums';

/** Pure usedDays delta for reservation-based leave balance. Null previous = new create. */
export function leaveBalanceUsedDaysChange(
  previousStatus: LeaveStatus | null,
  nextStatus: LeaveStatus,
  duration: number,
): number {
  if (previousStatus === null && nextStatus === LeaveStatus.PENDING) {
    return duration;
  }
  if (previousStatus === LeaveStatus.PENDING && nextStatus === LeaveStatus.APPROVED) {
    return 0;
  }
  if (
    previousStatus === LeaveStatus.PENDING &&
    (nextStatus === LeaveStatus.REJECTED || nextStatus === LeaveStatus.CANCELLED)
  ) {
    return -duration;
  }
  if (
    previousStatus === LeaveStatus.APPROVED &&
    (nextStatus === LeaveStatus.REJECTED || nextStatus === LeaveStatus.CANCELLED)
  ) {
    return -duration;
  }
  return 0;
}
