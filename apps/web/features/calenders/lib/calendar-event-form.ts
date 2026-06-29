export type EventSpanMode = 'single' | 'range';

export const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder', minutes: null as number | null },
  { value: '0', label: 'At event time', minutes: 0 },
  { value: '5', label: '5 minutes before', minutes: 5 },
  { value: '15', label: '15 minutes before', minutes: 15 },
  { value: '30', label: '30 minutes before', minutes: 30 },
  { value: '60', label: '1 hour before', minutes: 60 },
  { value: '1440', label: '1 day before', minutes: 1440 },
] as const;

export function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeLabel(time?: string | null): string | undefined {
  if (!time) return undefined;
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(
  startTime?: string | null,
  endTime?: string | null,
): string | undefined {
  const start = formatTimeLabel(startTime);
  const end = formatTimeLabel(endTime);
  if (start && end) return `${start} – ${end}`;
  return start ?? end;
}

export function formatReminderLabel(minutes?: number | null): string | undefined {
  if (minutes == null) return undefined;
  const option = REMINDER_OPTIONS.find((item) => item.minutes === minutes);
  return option?.label ?? `${minutes} min before`;
}
