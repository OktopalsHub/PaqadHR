import { formatPersonName } from '@/lib/format-name';

type ApiLeave = {
  id: string;
  startDate: string;
  endDate: string;
  duration: number;
  status: string;
  reason: string;
  leaveType?: { name: string } | null;
  requester?: { id?: string; firstName?: string; lastName?: string } | null;
};

function requesterName(requester?: ApiLeave['requester']) {
  if (!requester) return 'Unknown';
  return formatPersonName(requester.firstName, requester.lastName, 'Unknown');
}

export function mapApiLeaveToLeaveRequest(leave: ApiLeave) {
  return {
    id: leave.id,
    employee: requesterName(leave.requester),
    requesterId: leave.requester?.id,
    type: leave.leaveType?.name ?? 'Leave',
    startDate: new Date(leave.startDate).toISOString().slice(0, 10),
    endDate: new Date(leave.endDate).toISOString().slice(0, 10),
    days: leave.duration,
    status: leave.status,
    reason: leave.reason,
  };
}
