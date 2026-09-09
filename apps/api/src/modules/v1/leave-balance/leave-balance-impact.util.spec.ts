import { LeaveStatus } from 'src/common/enums';
import { leaveBalanceUsedDaysChange } from './leave-balance-impact.util';

describe('leaveBalanceUsedDaysChange', () => {
  it('reserves on create and releases on pending delete/reject', () => {
    expect(leaveBalanceUsedDaysChange(null, LeaveStatus.PENDING, 3)).toBe(3);
    expect(leaveBalanceUsedDaysChange(LeaveStatus.PENDING, LeaveStatus.APPROVED, 3)).toBe(0);
    expect(leaveBalanceUsedDaysChange(LeaveStatus.PENDING, LeaveStatus.REJECTED, 3)).toBe(-3);
    expect(leaveBalanceUsedDaysChange(LeaveStatus.PENDING, LeaveStatus.CANCELLED, 3)).toBe(-3);
  });

  it('releases on cancel of approved leave', () => {
    expect(leaveBalanceUsedDaysChange(LeaveStatus.APPROVED, LeaveStatus.CANCELLED, 5)).toBe(-5);
  });
});
