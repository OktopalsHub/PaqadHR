import type { LeaveBalance } from "@/lib/schemas/leave";

type ApiLeaveBalance = {
  leaveTypeId: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  leaveType?: { name?: string } | null;
};

export function mapApiLeaveBalance(balance: ApiLeaveBalance): LeaveBalance {
  return {
    leaveTypeId: balance.leaveTypeId,
    leaveTypeName: balance.leaveType?.name ?? "Leave",
    allocated: balance.totalDays,
    used: balance.usedDays,
    remaining: balance.remainingDays,
  };
}

export function mapApiLeaveBalances(balances: ApiLeaveBalance[]): LeaveBalance[] {
  return balances.map(mapApiLeaveBalance);
}
