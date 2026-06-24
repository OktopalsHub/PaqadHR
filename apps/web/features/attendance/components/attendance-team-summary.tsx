'use client';

import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  dayCellClass,
  memberDisplayName,
  statusLabel,
} from '@/features/attendance/lib/attendance-utils';
import { useMonthlyTimesheet } from '@/hooks/queries/use-attendance';
import { useEmployees } from '@/hooks/queries/use-employees';
import { useTenantSettings } from '@/hooks/queries/use-tenant-settings';
import type { MonthlyTimesheetMember } from '@/lib/api/attendance';
import { getInitials } from '@/lib/utils';

function MonthYearPicker({
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
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="team-month">Month</Label>
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
          className="w-[180px]"
        />
      </div>
    </div>
  );
}

function isHolidayDate(dateStr: string, customHolidays?: Array<{ date: string; name: string; recursYearly?: boolean }>) {
  if (!customHolidays || !Array.isArray(customHolidays)) return null;
  const mmdd = dateStr.substring(5); // MM-DD
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
  tenantSettings?: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = memberDisplayName(entry.member);
  const stats = entry.statistics;

  return (
    <>
      <TableRow>
        <TableCell>
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
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={avatar || '/placeholder.svg'} />
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{name}</span>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {entry.member.employeeNumber ?? '—'}
        </TableCell>
        <TableCell>{stats.presentDays}</TableCell>
        <TableCell>{stats.absentDays}</TableCell>
        <TableCell>{stats.leaveDays}</TableCell>
        <TableCell>{stats.attendanceRate.toFixed(1)}%</TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20">
            <div className="flex flex-wrap gap-1 py-2">
              {entry.dailyAttendance.map((day) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const dateObj = new Date(day.date);
                
                const weekends = tenantSettings?.settings?.attendance?.weekends ?? [0, 6];
                const isWeekend = weekends.includes(dateObj.getDay());
                const holidayName = isHolidayDate(day.date, tenantSettings?.settings?.holidays?.customHolidays);
                
                const isPast = day.date < todayStr;
                const isFuture = day.date > todayStr;
                const isToday = day.date === todayStr;
                const isPresent = day.status === 'PRESENT' || day.status === 'LATE';
                
                let cellColorClass = 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-650'; // default future / Gray
                
                if (isPresent) {
                  cellColorClass = 'bg-emerald-500 text-white dark:bg-emerald-600'; // Green
                } else if (isWeekend || holidayName) {
                  cellColorClass = 'bg-zinc-700 text-zinc-100 dark:bg-zinc-800 dark:text-zinc-200'; // Dark Gray
                } else if (isPast || isToday) {
                  cellColorClass = 'bg-rose-500 text-white dark:bg-rose-600'; // Red
                }
                
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
                    className={`flex size-7 items-center justify-center rounded text-[10px] font-medium transition-colors ${cellColorClass}`}
                  >
                    {day.day}
                  </div>
                );
              })}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function AttendanceTeamSummary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMonthlyTimesheet(month, year, page);
  const { data: employees = [] } = useEmployees();
  const { data: tenantSettings } = useTenantSettings();

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const pagination = data?.pagination;

  return (
    <>
      <div className="border-b border-border/60 px-4 py-3">
        <MonthYearPicker
          month={month}
          year={year}
          onMonthChange={(value) => {
            setMonth(value);
            setPage(1);
          }}
          onYearChange={(value) => {
            setYear(value);
            setPage(1);
          }}
        />
      </div>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Employee #</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Leave</TableHead>
                <TableHead>Attendance %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
            </TableBody>
          </Table>
          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} members
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
