'use client';

import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
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
import { Input } from '@/components/ui/input';
import { AttendanceDateFilters } from '@/features/attendance/components/attendance-date-filters';
import {
  type DateRangePreset,
  formatRecordDate,
  formatTimeOnly,
  memberDisplayName,
  resolveDateRange,
  statusLabel,
} from '@/features/attendance/lib/attendance-utils';
import { useTeamAttendanceRecords } from '@/hooks/queries/use-attendance';
import { useEmployees } from '@/hooks/queries/use-employees';
import { getInitials } from '@/lib/utils';

function getAttendanceStatusStyles(status: string) {
  const key = status.toUpperCase();
  switch (key) {
    case 'PRESENT':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400';
    case 'LATE':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400';
    case 'ABSENT':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400';
    case 'ON_LEAVE':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400';
    case 'WEEKEND':
      return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
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
      <div className="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800">
        <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-start xl:justify-between">
          <AttendanceDateFilters
            preset={preset}
            from={range.from}
            to={range.to}
            onPresetChange={setPreset}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />
          <div className="relative w-full xl:w-[340px] xl:flex-none">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search by name or employee number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-slate-200 bg-white py-2 pr-3 pl-10 text-slate-700 shadow-none placeholder:text-slate-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24] dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
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
        <AppTable className="min-w-[980px]">
          <AppTableHeaderSection>
            <AppTableHeaderRow>
              <AppTableHeadCell>Member</AppTableHeadCell>
              <AppTableHeadCell>Employee #</AppTableHeadCell>
              <AppTableHeadCell>Date</AppTableHeadCell>
              <AppTableHeadCell>Session</AppTableHeadCell>
              <AppTableHeadCell>Clock in</AppTableHeadCell>
              <AppTableHeadCell>Clock out</AppTableHeadCell>
              <AppTableHeadCell>Hours</AppTableHeadCell>
              <AppTableHeadCell>Status</AppTableHeadCell>
            </AppTableHeaderRow>
          </AppTableHeaderSection>
          <AppTableBodySection>
            {filteredRecords.map((record) => {
              const name = memberDisplayName(record.member ?? {});
              const employee = employees.find((emp) => emp.id === record.member?.id);
              return (
                <AppTableBodyRow key={record.id}>
                  <AppTableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={employee?.avatar || '/placeholder.svg'} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <span>{name}</span>
                    </div>
                  </AppTableCell>
                  <AppTableCell className="text-slate-500 dark:text-slate-400">
                    {record.member?.employeeNumber ?? '—'}
                  </AppTableCell>
                  <AppTableCell>{formatRecordDate(record.date)}</AppTableCell>
                  <AppTableCell>#{record.sessionNumber}</AppTableCell>
                  <AppTableCell>{formatTimeOnly(record.clockIn)}</AppTableCell>
                  <AppTableCell>{formatTimeOnly(record.clockOut)}</AppTableCell>
                  <AppTableCell>{record.workHours ?? '—'}</AppTableCell>
                  <AppTableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getAttendanceStatusStyles(
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
                  </AppTableCell>
                </AppTableBodyRow>
              );
            })}
          </AppTableBodySection>
        </AppTable>
      )}
    </>
  );
}
