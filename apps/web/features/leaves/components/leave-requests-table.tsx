'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Days</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reason</TableHead>
          {canApproveAny ? <TableHead>Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
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
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={requester?.avatar || '/placeholder.svg'} />
                    <AvatarFallback>{getInitials(request.employee)}</AvatarFallback>
                  </Avatar>
                  <span>{request.employee}</span>
                </div>
              </TableCell>
              <TableCell>{request.type}</TableCell>
              <TableCell>{request.startDate}</TableCell>
              <TableCell>{request.endDate}</TableCell>
              <TableCell>{request.days}</TableCell>
              <TableCell>
                <LeaveStatusBadge status={request.status} />
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
              {canApproveAny ? (
                <TableCell>
                  {isPending && canApprove ? (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        disabled={isBusy}
                        onClick={() => void handleApprove(request.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs text-red-500 border-red-200 hover:bg-red-50"
                        disabled={isBusy}
                        onClick={() => void handleReject(request.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
