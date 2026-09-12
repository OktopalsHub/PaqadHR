'use client';

import { useState } from 'react';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDailyReport, useMonthlyReport } from '@/hooks/queries/use-attendance';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function AttendanceReportsTab() {
  const now = new Date();
  const [view, setView] = useState<'daily' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedDate, setSelectedDate] = useState(now.toISOString().split('T')[0]);

  const month = parseInt(selectedMonth, 10);
  const year = parseInt(selectedYear, 10);

  const { data: dailyReport = [], isLoading: dailyLoading } = useDailyReport(
    view === 'daily' ? selectedDate : undefined,
  );
  const { data: monthlyReport = [], isLoading: monthlyLoading } = useMonthlyReport(
    view === 'monthly' ? month : now.getMonth() + 1,
    view === 'monthly' ? year : now.getFullYear(),
  );

  const isLoading = view === 'daily' ? dailyLoading : monthlyLoading;

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Attendance Reports</CardTitle>
        <div className="flex gap-2">
          <Select value={view} onValueChange={(v) => setView(v as 'daily' | 'monthly')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          {view === 'daily' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            />
          ) : (
            <>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Loading report…</div>
        ) : view === 'daily' ? (
          dailyReport.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">No data for this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <AppTable className="min-w-[760px]">
                <AppTableHeaderSection>
                  <AppTableHeaderRow>
                    <AppTableHeadCell>Member</AppTableHeadCell>
                    <AppTableHeadCell>Status</AppTableHeadCell>
                    <AppTableHeadCell>Clock In</AppTableHeadCell>
                    <AppTableHeadCell>Clock Out</AppTableHeadCell>
                    <AppTableHeadCell className="text-right">Hours</AppTableHeadCell>
                    <AppTableHeadCell className="text-right">Sessions</AppTableHeadCell>
                  </AppTableHeaderRow>
                </AppTableHeaderSection>
                <AppTableBodySection>
                  {dailyReport.map((r) => (
                    <AppTableBodyRow key={r.memberId}>
                      <AppTableCell className="font-medium">{r.memberName}</AppTableCell>
                      <AppTableCell>{r.status}</AppTableCell>
                      <AppTableCell>
                        {r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : '—'}
                      </AppTableCell>
                      <AppTableCell>
                        {r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : '—'}
                      </AppTableCell>
                      <AppTableCell className="text-right">{r.workHours ?? '—'}</AppTableCell>
                      <AppTableCell className="text-right">{r.sessions}</AppTableCell>
                    </AppTableBodyRow>
                  ))}
                </AppTableBodySection>
              </AppTable>
            </div>
          )
        ) : monthlyReport.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <AppTable className="min-w-[700px]">
              <AppTableHeaderSection>
                <AppTableHeaderRow>
                  <AppTableHeadCell>Member</AppTableHeadCell>
                  <AppTableHeadCell className="text-right">Present</AppTableHeadCell>
                  <AppTableHeadCell className="text-right">Absent</AppTableHeadCell>
                  <AppTableHeadCell className="text-right">Late</AppTableHeadCell>
                  <AppTableHeadCell className="text-right">Hours</AppTableHeadCell>
                  <AppTableHeadCell className="text-right">Rate</AppTableHeadCell>
                </AppTableHeaderRow>
              </AppTableHeaderSection>
              <AppTableBodySection>
                {monthlyReport.map((r) => (
                  <AppTableBodyRow key={r.memberId}>
                    <AppTableCell className="font-medium">{r.memberName}</AppTableCell>
                    <AppTableCell className="text-right">{r.presentDays}</AppTableCell>
                    <AppTableCell className="text-right">{r.absentDays}</AppTableCell>
                    <AppTableCell className="text-right">{r.lateDays}</AppTableCell>
                    <AppTableCell className="text-right">{r.workHours}</AppTableCell>
                    <AppTableCell className="text-right">{r.attendanceRate}%</AppTableCell>
                  </AppTableBodyRow>
                ))}
              </AppTableBodySection>
            </AppTable>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
