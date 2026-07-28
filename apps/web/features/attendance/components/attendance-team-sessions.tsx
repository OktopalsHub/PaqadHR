'use client';

import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
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
import { Input } from '@/components/ui/input';
import { AttendanceDateFilters } from '@/features/attendance/components/attendance-date-filters';
import {
  attendanceStatusDotClass,
  attendanceStatusPillClass,
  type DateRangePreset,
  formatRecordDate,
  formatTimeOnly,
  memberDisplayName,
  resolveDateRange,
  statusLabel,
} from '@/features/attendance/lib/attendance-utils';
import { useTeamAttendanceRecords } from '@/hooks/queries/use-attendance';
import { useEmployees } from '@/hooks/queries/use-employees';

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
      <div className="border-b border-border/60 px-5 py-4">
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
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or employee number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="app-input-surface py-2 pr-3 pl-10"
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
                      <PersonAvatar
                        src={employee?.avatar}
                        name={name}
                        className="h-7 w-7 flex-shrink-0"
                      />
                      <span>{name}</span>
                    </div>
                  </AppTableCell>
                  <AppTableCell className="text-muted-foreground">
                    {record.member?.employeeNumber ?? '—'}
                  </AppTableCell>
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
              );
            })}
          </AppTableBodySection>
        </AppTable>
      )}
    </>
  );
}
