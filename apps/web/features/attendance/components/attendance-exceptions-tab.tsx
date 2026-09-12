'use client';

import { CheckCircle, XCircle } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveAttendanceException,
  useAttendanceExceptions,
  useRejectAttendanceException,
} from '@/hooks/queries/use-attendance';
import type { AttendanceException } from '@/lib/api/attendance';

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  OVERTIME: 'Overtime',
  UNDERTIME: 'Undertime',
  ABSENCE: 'Absence',
  LATE: 'Late',
};

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function AttendanceExceptionsTab() {
  const { data: exceptions = [], isLoading } = useAttendanceExceptions();
  const approve = useApproveAttendanceException();
  const reject = useRejectAttendanceException();

  const [reviewing, setReviewing] = useState<{
    exception: AttendanceException;
    action: 'approve' | 'reject';
  } | null>(null);
  const [comments, setComments] = useState('');

  const pendingCount = exceptions.filter((e) => e.status === 'PENDING').length;

  const handleReview = async () => {
    if (!reviewing) return;
    try {
      if (reviewing.action === 'approve') {
        await approve.mutateAsync({
          exceptionId: reviewing.exception.id,
          comments: comments || undefined,
        });
        toast.success('Exception approved');
      } else {
        if (!comments.trim()) {
          toast.error('A comment is required to reject');
          return;
        }
        await reject.mutateAsync({ exceptionId: reviewing.exception.id, comments });
        toast.success('Exception rejected');
      }
      setReviewing(null);
      setComments('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to review exception');
    }
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">Loading exceptions…</div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Attendance Exceptions
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                {pendingCount} pending
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">No exceptions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <AppTable className="min-w-[680px]">
                <AppTableHeaderSection>
                  <AppTableHeaderRow>
                    <AppTableHeadCell>Date</AppTableHeadCell>
                    <AppTableHeadCell>Type</AppTableHeadCell>
                    <AppTableHeadCell>Reason</AppTableHeadCell>
                    <AppTableHeadCell>Status</AppTableHeadCell>
                    <AppTableHeadCell className="w-28" />
                  </AppTableHeaderRow>
                </AppTableHeaderSection>
                <AppTableBodySection>
                  {exceptions.map((ex) => (
                    <AppTableBodyRow key={ex.id}>
                      <AppTableCell>{new Date(ex.date).toLocaleDateString()}</AppTableCell>
                      <AppTableCell>{EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}</AppTableCell>
                      <AppTableCell className="max-w-[200px] truncate">{ex.reason}</AppTableCell>
                      <AppTableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[ex.status] ?? ''}`}
                        >
                          {ex.status}
                        </span>
                      </AppTableCell>
                      <AppTableCell className="text-right">
                        {ex.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-green-600"
                              onClick={() => setReviewing({ exception: ex, action: 'approve' })}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-red-600"
                              onClick={() => setReviewing({ exception: ex, action: 'reject' })}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </AppTableCell>
                    </AppTableBodyRow>
                  ))}
                </AppTableBodySection>
              </AppTable>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing?.action === 'approve' ? 'Approve Exception' : 'Reject Exception'}
            </DialogTitle>
            <DialogDescription>
              {reviewing?.action === 'approve'
                ? 'Optionally add a comment before approving.'
                : 'Provide a reason for rejecting this exception.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="review-comments">Comments</Label>
            <Textarea
              id="review-comments"
              placeholder={
                reviewing?.action === 'approve' ? 'Optional comment…' : 'Rejection reason…'
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewing?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={approve.isPending || reject.isPending}
            >
              {reviewing?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
