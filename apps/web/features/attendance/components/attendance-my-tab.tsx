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
  attendanceStatusDotClass,
  attendanceStatusPillClass,
  type DateRangePreset,
  formatRecordDate,
  formatTimeOnly,
  resolveDateRange,
  statusLabel,
  summarizeAttendanceRecords,
} from '@/features/attendance/lib/attendance-utils';
import { useMyAttendanceRecords } from '@/hooks/queries/use-attendance';

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
          <div className="grid grid-cols-1 gap-px border-b border-border/60 bg-border/60 sm:grid-cols-3">
            <div className="dashboard-soft-tile rounded-none border-0 px-5 py-4 text-center">
              <p className="dashboard-outline-label text-xs font-semibold uppercase tracking-[0.08em]">
                Sessions
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {totals.sessionCount}
              </p>
            </div>
            <div className="dashboard-soft-tile rounded-none border-0 px-5 py-4 text-center">
              <p className="dashboard-outline-label text-xs font-semibold uppercase tracking-[0.08em]">
                Total hours
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {totals.formattedHours}
              </p>
            </div>
            <div className="dashboard-soft-tile rounded-none border-0 px-5 py-4 text-center">
              <p className="dashboard-outline-label text-xs font-semibold uppercase tracking-[0.08em]">
                Days worked
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${attendanceStatusPillClass(
                        record.status,
                      )}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${attendanceStatusDotClass(
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
