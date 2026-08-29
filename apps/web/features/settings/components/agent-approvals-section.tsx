'use client';

import { Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useApproveAgentAction,
  usePendingAgentApprovals,
  useRejectAgentAction,
} from '@/hooks/queries/use-agent-approvals';
import { useTenant } from '@/providers/tenant-provider';

const ACTION_LABELS: Record<string, string> = {
  'leave.approve': 'Approve leave',
  'leave.reject': 'Reject leave',
  'payroll.run.create': 'Create payroll run',
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatParamsSummary(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  if (!entries.length) return 'No parameters';
  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}

export function AgentApprovalsSection() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: pending, isLoading, isError } = usePendingAgentApprovals(tenantId, isAdmin);
  const approveAction = useApproveAgentAction(tenantId);
  const rejectAction = useRejectAgentAction(tenantId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only workspace owners and admins can review agent actions.
      </p>
    );
  }

  const handleApprove = async (actionId: string) => {
    setBusyId(actionId);
    try {
      await approveAction.mutateAsync(actionId);
      toast.success('Agent action approved and executed.');
    } catch {
      toast.error('Failed to approve agent action.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget);
    try {
      await rejectAction.mutateAsync({
        actionId: rejectTarget,
        reason: rejectReason.trim() || undefined,
      });
      toast.success('Agent action rejected.');
      setRejectTarget(null);
      setRejectReason('');
    } catch {
      toast.error('Failed to reject agent action.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        High-risk actions requested by API keys or agents (leave approvals, payroll runs) are queued
        here for owner/admin review. This is separate from Slack <code>/approvals</code> pending
        leave requests.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending actions…
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load pending agent actions.</p>
      ) : pending?.length ? (
        <ul className="divide-y rounded-lg border">
          {pending.map((item) => {
            const isBusy = busyId === item.id;
            return (
              <li key={item.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{formatActionLabel(item.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatParamsSummary(item.params)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(item.createdAt).toLocaleString()}
                      {item.apiKeyName ? ` · API key: ${item.apiKeyName}` : ''}
                      {item.requestedByMemberName ? ` · ${item.requestedByMemberName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      disabled={isBusy}
                    >
                      {isBusy && approveAction.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectTarget(item.id)}
                      disabled={isBusy}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No agent actions awaiting approval.</p>
      )}

      <AlertDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject agent action?</AlertDialogTitle>
            <AlertDialogDescription>
              The action will not run. You can optionally add a reason for the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Not authorized for this payroll period"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject}>Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
