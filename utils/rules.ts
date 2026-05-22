// ─── HRMS Work Rules ─────────────────────────────────────────────────────────

/** Full day required working hours in milliseconds (8h 30m) */
export const FULL_DAY_MS = (8 * 60 + 30) * 60 * 1000;

/** Half-day threshold in milliseconds (6h) */
export const HALF_DAY_MS = 6 * 60 * 60 * 1000;

/** Total allowed break time per day in milliseconds (45 minutes) */
export const MAX_BREAK_MS = 45 * 60 * 1000;

/** Late login threshold — minutes after which login is considered late */
export const LATE_LOGIN_THRESHOLD_MINUTES = 30;

/** Expected clock-in time (HH:MM 24h) */
export const EXPECTED_CLOCK_IN = '09:30';

/** Expected clock-out time — derived: clockIn + FULL_DAY_MS */
export const WORK_DAY_START_HOUR = 9;
export const WORK_DAY_START_MINUTE = 30;

export function msToHours(ms: number): number {
  return Number((ms / (1000 * 60 * 60)).toFixed(4));
}

export function msToMinutes(ms: number): number {
  return Math.floor(ms / (1000 * 60));
}

/** Format milliseconds as HH:MM:SS */
export function formatDuration(ms: number): string {
  const isNegative = ms < 0;
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const p = (n: number) => n.toString().padStart(2, '0');
  const sign = isNegative ? '-' : '';
  return `${sign}${p(h)}:${p(m)}:${p(s)}`;
}

/** Format milliseconds as "Xh Ym" */
export function formatHoursMinutes(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / (1000 * 60)));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
