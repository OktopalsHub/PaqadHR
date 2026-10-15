import { format } from 'date-fns';

export function formatDate(value: string | Date, pattern = 'MMM d, yyyy'): string {
  return format(typeof value === 'string' ? new Date(value) : value, pattern);
}

export function formatDateTime(value: string | Date, pattern = 'MMM d, yyyy h:mm a'): string {
  return format(typeof value === 'string' ? new Date(value) : value, pattern);
}
