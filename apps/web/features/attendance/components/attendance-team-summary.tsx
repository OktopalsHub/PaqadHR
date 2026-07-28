'use client';

import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { PersonAvatar } from '@/components/person-avatar';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableFooterBar,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  dayCellClass,
  memberDisplayName,
  statusLabel,
} from '@/features/attendance/lib/attendance-utils';
import { useMonthlyTimesheet } from '@/hooks/queries/use-attendance';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import type { MonthlyTimesheetMember } from '@/lib/api/attendance';
import type { TenantSettingsResponse } from '@/lib/api/tenant-settings';

export function AttendanceSummaryMonthPicker({
  month,
  year,
  onMonthChange,
  onYearChange,
}: {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}) {
  const monthValue = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">Month</span>
      <Input
        id="team-month"
        type="month"
        value={monthValue}
        onChange={(e) => {
          const [y, m] = e.target.value.split('-').map(Number);
          if (y && m) {
            onYearChange(y);
            onMonthChange(m);
          }
        }}
        className="app-input-surface w-[180px]"
      />
    </div>
  );
}

function isHolidayDate(
  dateStr: string,
  customHolidays?: Array<{ date: string; name: string; recursYearly?: boolean }>,
) {
  if (!customHolidays || !Array.isArray(customHolidays)) return null;
  const mmdd = dateStr.substring(5);
  const holiday = customHolidays.find((h) => {
    if (h.recursYearly) {
      return h.date.endsWith(mmdd);
    }
    return h.date === dateStr;
  });
  return holiday ? holiday.name : null;
}

function MemberSummaryRow({
  entry,
  avatar,
  tenantSettings,
}: {
  entry: MonthlyTimesheetMember;
  avatar?: string;
  tenantSettings?: TenantSettingsResponse;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = memberDisplayName(entry.member);
  const stats = entry.statistics;
  const expandedRow = expanded ? (
    <AppTableBodyRow className="bg-muted/35 hover:bg-muted/35">
      <AppTableCell colSpan={6}>
        <div className="flex flex-wrap gap-1 py-2">
          {entry.dailyAttendance.map((day) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const dateObj = new Date(day.date);

            const weekends = tenantSettings?.settings?.attendance?.weekends ?? [0, 6];
            const isWeekend = weekends.includes(dateObj.getDay());
            const holidayName = isHolidayDate(
              day.date,
              tenantSettings?.settings?.holidays?.customHolidays,
            );

            const isFutureWorkingDay = !isWeekend && !holidayName && day.date > todayStr;
            const cellColorClass =
              isWeekend || holidayName
                ? 'bg-secondary text-secondary-foreground'
                : isFutureWorkingDay
                  ? 'bg-muted text-muted-foreground'
                  : dayCellClass(day.status);

            const dayOfWeekName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            let hoverText = `${day.date} (${dayOfWeekName})`;
            if (holidayName) {
              hoverText += ` - Holiday: ${holidayName}`;
            } else if (isWeekend) {
              hoverText += ` - Weekend (${dayOfWeekName})`;
            } else {
              hoverText += ` - Status: ${statusLabel(day.status)}`;
            }

            return (
              <div
                key={day.date}
                title={hoverText}
                className={`flex size-7 items-center justify-center rounded-[6px] text-[10px] font-medium transition-colors ${cellColorClass}`}
              >
                {day.day}
              </div>
            );
          })}
        </div>
      </AppTableCell>
    </AppTableBodyRow>
  ) : null;

  return (
    <>
      <AppTableBodyRow>
        <AppTableCell>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-1"
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
            <div className="flex items-center gap-2">
              <PersonAvatar src={avatar} name={name} className="h-7 w-7 flex-shrink-0" />
              <span className="font-medium">{name}</span>
            </div>
          </div>
        </AppTableCell>
        <AppTableCell className="text-muted-foreground">
          {entry.member.employeeNumber ?? '—'}
        </AppTableCell>
        <AppTableCell>{stats.presentDays}</AppTableCell>
        <AppTableCell>{stats.absentDays}</AppTableCell>
        <AppTableCell>{stats.leaveDays}</AppTableCell>
        <AppTableCell>{stats.attendanceRate.toFixed(1)}%</AppTableCell>
      </AppTableBodyRow>
      {expandedRow}
    </>
  );
}

export function AttendanceTeamSummary({ month, year }: { month: number; year: number }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMonthlyTimesheet(month, year, page);
  const { data: employees = [] } = useEmployees();
  const { data: tenantSettings } = useTenantSettings();

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const pagination = data?.pagination;

  return (
    <>
      {isLoading ? (
        <div className="p-4">
          <LoadingBlock />
        </div>
      ) : members.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Users}
            title="No attendance data for this month"
            description="Members will appear here once they clock in or leave is recorded."
          />
        </div>
      ) : (
        <>
          <AppTable className="min-w-[860px]">
            <AppTableHeaderSection>
              <AppTableHeaderRow>
                <AppTableHeadCell>Member</AppTableHeadCell>
                <AppTableHeadCell>Employee #</AppTableHeadCell>
                <AppTableHeadCell>Present</AppTableHeadCell>
                <AppTableHeadCell>Absent</AppTableHeadCell>
                <AppTableHeadCell>Leave</AppTableHeadCell>
                <AppTableHeadCell>Attendance %</AppTableHeadCell>
              </AppTableHeaderRow>
            </AppTableHeaderSection>
            <AppTableBodySection>
              {members.map((entry) => {
                const employee = employees.find((emp) => emp.id === entry.member.id);
                return (
                  <MemberSummaryRow
                    key={entry.member.id}
                    entry={entry}
                    avatar={employee?.avatar}
                    tenantSettings={tenantSettings}
                  />
                );
              })}
            </AppTableBodySection>
          </AppTable>
          {pagination && pagination.totalPages > 1 ? (
            <AppTableFooterBar>
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} members
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border/70 bg-background/80 text-foreground shadow-none hover:bg-muted/35 hover:text-foreground"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border/70 bg-background/80 text-foreground shadow-none hover:bg-muted/35 hover:text-foreground"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </AppTableFooterBar>
          ) : null}
        </>
      )}
    </>
  );
}
