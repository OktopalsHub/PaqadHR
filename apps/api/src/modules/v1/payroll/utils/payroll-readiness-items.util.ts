import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';

/** Items that still count toward run readiness / approval (not removed from the run). */
export function isActivePayrollReadinessItem(item: {
  status: PayrollItemStatus | string;
  metadata?: { excludedFromRun?: boolean } | null;
}): boolean {
  if (item.status === PayrollItemStatus.CANCELLED || item.status === 'cancelled') {
    return false;
  }
  if (item.metadata?.excludedFromRun) {
    return false;
  }
  return true;
}
