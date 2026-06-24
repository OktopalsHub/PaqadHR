'use client';

import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  memberDisplayName,
  resolveDateRange,
  statusBadgeVariant,
  statusLabel,
} from '@/features/attendance/lib/attendance-utils';
import { useTeamAttendanceRecords } from '@/hooks/queries/use-attendance';
import { useEmployees } from '@/hooks/queries/use-employees';
import { getInitials } from '@/lib/utils';

function getAttendanceStatusStyles(status: string) {
  const key = status.toUpperCase();
  switch (key) {
    case 'PRESENT':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900';
    case 'LATE':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900';
    case 'ABSENT':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900';
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

export function AttendanceTeamSessions() {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');

  const range = useMemo(
    () => resolveDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data: records = [], isLoading } = useTeamAttendanceRecords(range.from, range.to);
  const { data: employees = [] } = useEmployees();

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...records].sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      if (dateCompare !== 0) return dateCompare;
      return (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0);
    });
    if (!query) return sorted;
    return sorted.filter((record) => {
      const name = memberDisplayName(record.member ?? {}).toLowerCase();
      const emp = record.member?.employeeNumber?.toLowerCase() ?? '';
      return name.includes(query) || emp.includes(query);
    });
  }, [records, search]);

  return (
    <>
      <div className="space-y-3 border-b border-border/60 px-4 py-3">
        <AttendanceDateFilters
          preset={preset}
          from={range.from}
          to={range.to}
          onPresetChange={setPreset}
          onFromChange={setCustomFrom}
          onToChange={setCustomTo}
        />
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-4">
          <LoadingBlock />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Users}
            title="No clock entries in this range"
            description="Adjust the date filter or search, or wait for members to clock in."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Employee #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((record) => {
              const name = memberDisplayName(record.member ?? {});
              const employee = employees.find((emp) => emp.id === record.member?.id);
              return (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={employee?.avatar || '/placeholder.svg'} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <span>{name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {record.member?.employeeNumber ?? '—'}
                  </TableCell>
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
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
