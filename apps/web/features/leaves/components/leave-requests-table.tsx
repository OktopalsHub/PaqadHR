'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  useApproveLeave,
  useLeaveApprovalContext,
  useRejectLeave,
} from '@/hooks/queries/use-leaves';
import { canApproveLeaveRequest } from '@/lib/auth/manager-access';
import type { LeaveRequest } from '@/lib/schemas/leave';
import { getInitials } from '@/lib/utils';
import { LeaveStatusBadge } from './leave-status-badge';

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
}

export function LeaveRequestsTable({ requests }: LeaveRequestsTableProps) {
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const { viewerMemberId, viewerRole, employees } = useLeaveApprovalContext();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canApproveAny = requests.some((request) =>
    canApproveLeaveRequest(viewerMemberId ?? '', request.requesterId, employees, viewerRole),
  );

  const handleApprove = async (leaveId: string) => {
    setPendingId(leaveId);
    try {
      await approveLeave.mutateAsync({ leaveId });
      toast.success('Leave request approved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to approve leave');
    } finally {
      setPendingId(null);
    }
  };

  const handleReject = async (leaveId: string) => {
    setPendingId(leaveId);
    try {
      await rejectLeave.mutateAsync({ leaveId });
      toast.success('Leave request rejected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reject leave');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AppTable className="min-w-[980px]">
      <AppTableHeaderSection>
        <AppTableHeaderRow>
          <AppTableHeadCell>Employee</AppTableHeadCell>
          <AppTableHeadCell>Type</AppTableHeadCell>
          <AppTableHeadCell>From</AppTableHeadCell>
          <AppTableHeadCell>To</AppTableHeadCell>
          <AppTableHeadCell>Days</AppTableHeadCell>
          <AppTableHeadCell>Status</AppTableHeadCell>
          <AppTableHeadCell>Reason</AppTableHeadCell>
          {canApproveAny ? <AppTableHeadCell>Actions</AppTableHeadCell> : null}
        </AppTableHeaderRow>
      </AppTableHeaderSection>
      <AppTableBodySection>
        {requests.map((request) => {
          const isPending = request.status.toLowerCase() === 'pending';
          const isBusy = pendingId === request.id;
          const canApprove = canApproveLeaveRequest(
            viewerMemberId ?? '',
            request.requesterId,
            employees,
            viewerRole,
          );
          const requester = employees.find((emp) => emp.id === request.requesterId);

          return (
            <AppTableBodyRow key={request.id}>
              <AppTableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                    <AvatarImage src={requester?.avatar || '/placeholder.svg'} />
                    <AvatarFallback>{getInitials(request.employee)}</AvatarFallback>
                  </Avatar>
                  <span>{request.employee}</span>
                </div>
              </AppTableCell>
              <AppTableCell>{request.type}</AppTableCell>
              <AppTableCell>{request.startDate}</AppTableCell>
              <AppTableCell>{request.endDate}</AppTableCell>
              <AppTableCell>{request.days}</AppTableCell>
              <AppTableCell>
                <LeaveStatusBadge status={request.status} />
              </AppTableCell>
              <AppTableCell className="max-w-[200px] truncate">{request.reason}</AppTableCell>
              {canApproveAny ? (
                <AppTableCell>
                  {isPending && canApprove ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="brandSolid"
                        className="h-8 px-3 text-xs font-semibold"
                        disabled={isBusy}
                        onClick={() => void handleApprove(request.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-red-200 px-3 text-xs text-red-600 shadow-none hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:hover:bg-red-950/20"
                        disabled={isBusy}
                        onClick={() => void handleReject(request.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                  )}
                </AppTableCell>
              ) : null}
            </AppTableBodyRow>
          );
        })}
      </AppTableBodySection>
    </AppTable>
  );
}
