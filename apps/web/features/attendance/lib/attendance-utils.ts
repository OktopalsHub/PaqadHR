import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { formatPersonName } from '@/lib/format-name';

export type DateRangePreset = 'week' | '30d' | 'month' | 'custom';

export function memberDisplayName(member: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return formatPersonName(member.firstName, member.lastName, 'Team member');
}

export function formatTimeOnly(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'h:mm a');
}

/** Live-friendly duration label from milliseconds (e.g. "2h 14m", "45m 12s"). */
export function formatElapsedMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatRecordDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'EEE, MMM d, yyyy');
}

export function resolveDateRange(preset: DateRangePreset, customFrom?: string, customTo?: string) {
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');

  if (preset === 'week') {
    return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to };
  }
  if (preset === '30d') {
    return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to };
  }
  if (preset === 'month') {
    return {
      from: format(startOfMonth(today), 'yyyy-MM-dd'),
      to: format(endOfMonth(today), 'yyyy-MM-dd'),
    };
  }
  return {
    from: customFrom ?? format(subDays(today, 29), 'yyyy-MM-dd'),
    to: customTo ?? to,
  };
}

export function statusLabel(status: string) {
  switch (status) {
    case 'PRESENT':
      return 'Present';
    case 'LATE':
      return 'Late';
    case 'ABSENT':
      return 'Absent';
    case 'WEEKEND':
      return 'Weekend';
    case 'ON_LEAVE':
      return 'On leave';
    case 'HALF_DAY':
      return 'Half day';
    default:
      return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function statusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'PRESENT' || status === 'LATE') return 'default';
  if (status === 'ABSENT') return 'destructive';
  if (status === 'ON_LEAVE') return 'secondary';
  return 'outline';
}

export function dayCellClass(status: string) {
  switch (status) {
    case 'PRESENT':
    case 'LATE':
      return 'bg-primary/15 text-primary';
    case 'ABSENT':
      return 'bg-destructive/15 text-destructive';
    case 'ON_LEAVE':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    case 'WEEKEND':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted/50 text-muted-foreground';
  }
}

type WorkHoursRecord = { workHours?: string | null; date?: string | null };

export function parseWorkHours(value?: string | null): number {
  if (!value?.trim()) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sumWorkHours(records: WorkHoursRecord[]): number {
  return records.reduce((sum, record) => sum + parseWorkHours(record.workHours), 0);
}

export function countDistinctDays(records: WorkHoursRecord[]): number {
  const days = new Set(
    records.map((record) => record.date).filter((date): date is string => Boolean(date)),
  );
  return days.size;
}

export function formatHoursTotal(hours: number): string {
  if (hours <= 0) return '0';
  return hours % 1 === 0 ? String(hours) : hours.toFixed(1);
}

export function summarizeAttendanceRecords(records: WorkHoursRecord[]) {
  const totalHours = sumWorkHours(records);
  return {
    sessionCount: records.length,
    totalHours,
    daysWithSessions: countDistinctDays(records),
    formattedHours: formatHoursTotal(totalHours),
  };
}
