'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyReport.map((r) => (
                  <TableRow key={r.memberId}>
                    <TableCell className="font-medium">{r.memberName}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      {r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell>
                      {r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">{r.workHours ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.sessions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : monthlyReport.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No data for this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Late</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyReport.map((r) => (
                <TableRow key={r.memberId}>
                  <TableCell className="font-medium">{r.memberName}</TableCell>
                  <TableCell className="text-right">{r.presentDays}</TableCell>
                  <TableCell className="text-right">{r.absentDays}</TableCell>
                  <TableCell className="text-right">{r.lateDays}</TableCell>
                  <TableCell className="text-right">{r.workHours}</TableCell>
                  <TableCell className="text-right">{r.attendanceRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
