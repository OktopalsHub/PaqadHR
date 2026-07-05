'use client';

import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ContentCard } from '@/components/content-card';
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
import { AttendanceDateFilters } from '@/features/attendance/components/attendance-date-filters';
import {
  type DateRangePreset,
  formatRecordDate,
  formatTimeOnly,
  resolveDateRange,
  statusLabel,
  summarizeAttendanceRecords,
} from '@/features/attendance/lib/attendance-utils';
import { useMyAttendanceRecords } from '@/hooks/queries/use-attendance';

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
        className="dashboard-panel rounded-[8px]"
        action={
          <AttendanceDateFilters
            preset={preset}
            from={range.from}
            to={range.to}
            onPresetChange={setPreset}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />
        }
        headerClassName="gap-4 sm:items-start"
        bodyClassName="p-0"
      >
        {!isLoading && sortedRecords.length > 0 ? (
          <div className="grid grid-cols-1 gap-px border-b border-[#d7e3f6] bg-[#d7e3f6] sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800">
            <div className="dashboard-soft-tile rounded-none border-0 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#516079] dark:text-slate-400">
                Sessions
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-slate-100">
                {totals.sessionCount}
              </p>
            </div>
            <div className="dashboard-soft-tile rounded-none border-0 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#516079] dark:text-slate-400">
                Total hours
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-slate-100">
                {totals.formattedHours}
              </p>
            </div>
            <div className="dashboard-soft-tile rounded-none border-0 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#516079] dark:text-slate-400">
                Days worked
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-slate-100">
                {totals.daysWithSessions}
              </p>
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
              className="min-h-[360px] sm:min-h-[460px]"
            />
          </div>
        ) : (
          <AppTable className="min-w-[760px]">
            <AppTableHeaderSection>
              <AppTableHeaderRow>
                <AppTableHeadCell>Date</AppTableHeadCell>
                <AppTableHeadCell>Session</AppTableHeadCell>
                <AppTableHeadCell>Clock in</AppTableHeadCell>
                <AppTableHeadCell>Clock out</AppTableHeadCell>
                <AppTableHeadCell>Hours</AppTableHeadCell>
                <AppTableHeadCell>Status</AppTableHeadCell>
              </AppTableHeaderRow>
            </AppTableHeaderSection>
            <AppTableBodySection>
              {sortedRecords.map((record) => (
                <AppTableBodyRow key={record.id}>
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
              ))}
            </AppTableBodySection>
          </AppTable>
        )}
      </ContentCard>
    </div>
  );
}
