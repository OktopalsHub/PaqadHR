'use client';

import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AttendanceDateFilters } from '@/features/attendance/components/attendance-date-filters';
import {
  type DateRangePreset,
  formatRecordDate,
  formatTimeOnly,
  resolveDateRange,
  statusBadgeVariant,
  statusLabel,
  summarizeAttendanceRecords,
} from '@/features/attendance/lib/attendance-utils';
import { useMyAttendanceRecords } from '@/hooks/queries/use-attendance';

function getAttendanceStatusStyles(status: string) {
  const key = status.toUpperCase();
  switch (key) {
    case 'PRESENT':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900';
    case 'LATE':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900';
    case 'ABSENT':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-450 dark:border-red-900';
    case 'ON_LEAVE':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900';
    case 'WEEKEND':
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
  }
}

function getAttendanceStatusDotClass(status: string) {
  const key = status.toUpperCase();
  switch (key) {
    case 'PRESENT':
      return 'bg-green-500';
    case 'LATE':
      return 'bg-amber-500';
    case 'ABSENT':
      return 'bg-red-500';
    case 'ON_LEAVE':
      return 'bg-blue-500';
    default:
      return 'bg-gray-400 dark:bg-gray-500';
  }
}

export function AttendanceMyTab() {
  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(
    () => resolveDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data: records = [], isLoading } = useMyAttendanceRecords(range.from, range.to);

  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));
        if (dateCompare !== 0) return dateCompare;
        return (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0);
      }),
    [records],
  );

  const totals = useMemo(() => summarizeAttendanceRecords(sortedRecords), [sortedRecords]);

  return (
    <div className="space-y-5">
      <ContentCard
        title="Timesheet"
        description="Filter and review your clock entries"
        bodyClassName="p-0"
      >
        <div className="border-b border-border/60 px-4 py-3">
          <AttendanceDateFilters
            preset={preset}
            from={range.from}
            to={range.to}
            onPresetChange={setPreset}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />
        </div>
        {!isLoading && sortedRecords.length > 0 ? (
          <div className="grid grid-cols-3 gap-px border-b border-border/60 bg-border/60 text-center sm:grid-cols-3">
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Sessions</p>
              <p className="text-lg font-semibold tabular-nums">{totals.sessionCount}</p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Total hours</p>
              <p className="text-lg font-semibold tabular-nums">{totals.formattedHours}</p>
            </div>
            <div className="bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Days worked</p>
              <p className="text-lg font-semibold tabular-nums">{totals.daysWithSessions}</p>
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <div className="p-4">
            <LoadingBlock />
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Clock}
              title="No entries in this range"
              description="Adjust the date filter or clock in from the header."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{formatRecordDate(record.date)}</TableCell>
                  <TableCell>#{record.sessionNumber}</TableCell>
                  <TableCell>{formatTimeOnly(record.clockIn)}</TableCell>
                  <TableCell>{formatTimeOnly(record.clockOut)}</TableCell>
                  <TableCell>{record.workHours ?? '—'}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getAttendanceStatusStyles(
                        record.status,
                      )}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${getAttendanceStatusDotClass(
                          record.status,
                        )}`}
                      />
                      {statusLabel(record.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ContentCard>
    </div>
  );
}
