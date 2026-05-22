import { format } from 'date-fns';

export function formatTime(iso: string): string {
  return format(new Date(iso), 'hh:mm:ss a');
}

export function formatDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy');
}

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
