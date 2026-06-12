type ApiLeave = {
  id: string;
  startDate: string;
  endDate: string;
  duration: number;
  status: string;
  reason: string;
  leaveType?: { name: string } | null;
  requester?: { firstName?: string; lastName?: string } | null;
};

function requesterName(requester?: ApiLeave["requester"]) {
  if (!requester) return "Unknown";
  return [requester.firstName, requester.lastName].filter(Boolean).join(" ");
}

export function mapApiLeaveToLeaveRequest(leave: ApiLeave) {
  return {
    id: leave.id,
    employee: requesterName(leave.requester),
    type: leave.leaveType?.name ?? "Leave",
    startDate: new Date(leave.startDate).toISOString().slice(0, 10),
    endDate: new Date(leave.endDate).toISOString().slice(0, 10),
    days: leave.duration,
    status: leave.status,
    reason: leave.reason,
  };
}
