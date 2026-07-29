'use client';

import { RefreshCw, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAssignExistingLeaveTypes,
  useAssignmentReport,
  useSyncLeaveTypeAssignments,
} from '@/hooks/queries/use-leave-assignments';

export function LeaveAssignmentPanel() {
  const currentYear = new Date().getFullYear();
  const [year, _setYear] = useState(currentYear);

  const { data: report, isLoading } = useAssignmentReport(year);
  const syncAll = useSyncLeaveTypeAssignments();
  const assignExisting = useAssignExistingLeaveTypes();
  const missingAssignments = report?.missingAssignments ?? [];

  const handleSync = async () => {
    try {
      const result = await syncAll.mutateAsync(year);
      toast.success(`Created ${result.totalAssignments} missing assignments`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  const handleAssignExisting = async () => {
    try {
      const result = await assignExisting.mutateAsync(year);
      toast.success(`Created ${result.totalAssignments} missing assignments`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Leave Type Assignments</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncAll.isPending}>
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${syncAll.isPending ? 'animate-spin' : ''}`}
            />
            Sync All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignExisting}
            disabled={assignExisting.isPending}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Assign Existing
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Loading assignment report…
          </div>
        ) : !report ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Unable to load assignment data for {year}.
          </p>
        ) : missingAssignments.length === 0 ? (
          <div className="space-y-2 py-4 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              All active members have every leave type assigned for {year}.
            </p>
            <p className="text-muted-foreground text-sm">
              {report.completeAssignments} of {report.totalMembers} members are fully configured.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 px-4 py-3">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
                  Members
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                  {report.totalMembers}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 px-4 py-3">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
                  Complete
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                  {report.completeAssignments}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 px-4 py-3">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
                  Missing
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                  {missingAssignments.length}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Missing leave types</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingAssignments.map((entry) => (
                  <TableRow key={entry.memberId}>
                    <TableCell className="font-medium">
                      {entry.memberName || entry.memberId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {entry.missingTypes.map((leaveType) => (
                          <span
                            key={leaveType.leaveTypeId}
                            className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                          >
                            {leaveType.leaveTypeName}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{entry.missingTypes.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
