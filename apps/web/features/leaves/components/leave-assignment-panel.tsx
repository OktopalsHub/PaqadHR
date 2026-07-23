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

  const { data: report = [], isLoading } = useAssignmentReport(year);
  const syncAll = useSyncLeaveTypeAssignments();
  const assignExisting = useAssignExistingLeaveTypes();

  const handleSync = async () => {
    try {
      const result = await syncAll.mutateAsync(year);
      toast.success(`Synced ${result.synced} assignments`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  const handleAssignExisting = async () => {
    try {
      const result = await assignExisting.mutateAsync(year);
      toast.success(`Assigned leave types to ${result.assigned} members`);
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
        ) : report.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No assignment data for {year}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.map((entry) => (
                <TableRow key={`${entry.memberId}-${entry.leaveTypeId}`}>
                  <TableCell className="font-medium">
                    {entry.memberName ?? entry.email ?? entry.memberId}
                  </TableCell>
                  <TableCell>{entry.leaveTypeName ?? entry.leaveTypeId}</TableCell>
                  <TableCell className="text-right">{entry.totalDays}</TableCell>
                  <TableCell className="text-right">{entry.usedDays}</TableCell>
                  <TableCell className="text-right">{entry.remainingDays}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
