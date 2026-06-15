'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApproveLeave, useRejectLeave } from '@/hooks/queries/use-leaves';
import type { LeaveRequest } from '@/lib/schemas/leave';
import { LeaveStatusBadge } from './leave-status-badge';

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
}

export function LeaveRequestsTable({ requests }: LeaveRequestsTableProps) {
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const [pendingId, setPendingId] = useState<string | null>(null);

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
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => {
          const isPending = request.status.toLowerCase() === 'pending';
          const isBusy = pendingId === request.id;

          return (
            <TableRow key={request.id}>
              <TableCell className="font-medium">{request.employee}</TableCell>
              <TableCell>{request.type}</TableCell>
              <TableCell>{request.startDate}</TableCell>
              <TableCell>{request.endDate}</TableCell>
              <TableCell>{request.days}</TableCell>
              <TableCell>
                <LeaveStatusBadge status={request.status} />
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
              <TableCell>
                {isPending ? (
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
