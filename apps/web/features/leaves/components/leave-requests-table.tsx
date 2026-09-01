'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { PersonAvatar } from '@/components/person-avatar';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useApproveLeave,
  useDeleteLeave,
  useLeaveApprovalContext,
  useRejectLeave,
} from '@/hooks/queries/use-leaves';
import { canApproveLeaveRequest } from '@/lib/auth/manager-access';
import type { LeaveRequest } from '@/lib/schemas/leave';
import { EditLeaveRequestDialog } from './edit-leave-request-dialog';
import { LeaveStatusBadge } from './leave-status-badge';

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  rowNumberOffset?: number;
}

export function LeaveRequestsTable({ requests, rowNumberOffset = 0 }: LeaveRequestsTableProps) {
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const deleteLeave = useDeleteLeave();
  const { viewerMemberId, viewerRole, employees } = useLeaveApprovalContext();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [requestPendingDeletion, setRequestPendingDeletion] = useState<LeaveRequest | null>(null);
  const [viewingReason, setViewingReason] = useState<LeaveRequest | null>(null);

  const canApproveAny = requests.some((request) =>
    canApproveLeaveRequest(viewerMemberId ?? '', request.requesterId, employees, viewerRole),
  );
  const canEditAny = requests.some(
    (request) =>
      request.status.toLowerCase() === 'pending' && request.requesterId === viewerMemberId,
  );
  const showActions = canApproveAny || canEditAny;

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

  const handleDelete = async () => {
    if (!requestPendingDeletion) return;
    setPendingId(requestPendingDeletion.id);
    try {
      await deleteLeave.mutateAsync(requestPendingDeletion.id);
      toast.success('Leave request deleted');
      setRequestPendingDeletion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete leave request');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <AppTable className="min-w-[800px] whitespace-nowrap [&_td]:px-3 [&_td]:py-5 [&_th]:px-3 [&_th]:py-4 sm:[&_td]:px-4 sm:[&_th]:px-4">
          <AppTableHeaderSection>
            <AppTableHeaderRow>
              <AppTableHeadCell className="w-16">No.</AppTableHeadCell>
              <AppTableHeadCell>Employee</AppTableHeadCell>
              <AppTableHeadCell>Type</AppTableHeadCell>
              <AppTableHeadCell>From</AppTableHeadCell>
              <AppTableHeadCell>To</AppTableHeadCell>
              <AppTableHeadCell>Days</AppTableHeadCell>
              <AppTableHeadCell>Status</AppTableHeadCell>
              {showActions ? <AppTableHeadCell>Actions</AppTableHeadCell> : null}
              <AppTableHeadCell>Reason</AppTableHeadCell>
            </AppTableHeaderRow>
          </AppTableHeaderSection>
          <AppTableBodySection>
            {requests.map((request, index) => {
              const isPending = request.status.toLowerCase() === 'pending';
              const isBusy = pendingId === request.id;
              const canApprove = canApproveLeaveRequest(
                viewerMemberId ?? '',
                request.requesterId,
                employees,
                viewerRole,
              );
              const canEdit = isPending && request.requesterId === viewerMemberId;
              const requester = employees.find((emp) => emp.id === request.requesterId);

              return (
                <AppTableBodyRow key={request.id}>
                  <AppTableCell className="tabular-nums text-muted-foreground">
                    {rowNumberOffset + index + 1}
                  </AppTableCell>
                  <AppTableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <PersonAvatar
                        src={requester?.avatar}
                        name={request.employee}
                        className="h-8 w-8 flex-shrink-0 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                        fallbackClassName="bg-slate-100 text-[10px] font-bold text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      />
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
                  {showActions ? (
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
                      ) : canEdit ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Edit ${request.type} leave request`}
                            disabled={isBusy}
                            onClick={() => setEditingRequest(request)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${request.type} leave request`}
                            disabled={isBusy}
                            onClick={() => setRequestPendingDeletion(request)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </AppTableCell>
                  ) : null}
                  <AppTableCell className="min-w-[140px]">
                    <div className="group relative max-w-[220px]">
                      <p className="truncate pr-0 group-hover:pr-14 group-focus-within:pr-14">
                        {request.reason}
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="absolute inset-y-0 right-0 h-auto bg-background px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                        onClick={() => setViewingReason(request)}
                      >
                        View all
                      </Button>
                    </div>
                  </AppTableCell>
                </AppTableBodyRow>
              );
            })}
          </AppTableBodySection>
        </AppTable>
      </div>
      <Dialog
        open={Boolean(viewingReason)}
        onOpenChange={(open) => !open && setViewingReason(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Leave request reason</DialogTitle>
          </DialogHeader>
          <DialogDescription className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {viewingReason?.reason}
          </DialogDescription>
        </DialogContent>
      </Dialog>
      <EditLeaveRequestDialog
        request={editingRequest}
        onOpenChange={(open) => !open && setEditingRequest(null)}
      />
      <ConfirmActionDialog
        open={Boolean(requestPendingDeletion)}
        onOpenChange={(open) => !open && setRequestPendingDeletion(null)}
        title="Delete leave request?"
        description="This will permanently remove your pending leave request."
        actionLabel="Delete request"
        onConfirm={() => void handleDelete()}
        isPending={deleteLeave.isPending}
      />
    </>
  );
}
