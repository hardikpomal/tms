// ─── Attendance Types ────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'Present'
  | 'Full Day'
  | 'Half Day'
  | 'Late Login'
  | 'Early Logout'
  | 'Overtime'
  | 'Absent';

export interface AttendanceRecord {
  id?: number;
  date: string;          // YYYY-MM-DD
  clockIn: string;       // ISO timestamp
  clockOut?: string;     // ISO timestamp
  totalHours: number;    // decimal hours worked (ex-breaks)
  breakUsed: number;     // total break minutes used
  overtime: number;      // overtime decimal hours
  attendanceStatus: AttendanceStatus;
  breaks?: { start: string; end?: string }[]; // Historical exact timestamps of breaks
}

// Persisted across page reloads in localStorage
export interface AttendanceState {
  attendanceId: number | null;
  clockInTime: string | null;   // ISO
  isClocked: boolean;
  onBreak: boolean;
  breakStartTime: string | null; // ISO
  totalBreakMs: number;          // accumulated break milliseconds
  breakHistory: { start: string; end?: string }[];
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskStatus = 'In Progress' | 'Completed' | 'On Hold';

export interface TaskRecord {
  id?: number;
  attendanceId: number;
  project: string;
  description: string;
  startTime: string;   // ISO
  endTime?: string;    // ISO
  totalHours: number;
  status: TaskStatus;
}

// Persisted across page reloads in localStorage
export interface TimerState {
  isRunning: boolean;
  startTime: string | null;       // ISO
  project: string;
  description: string;
  status: TaskStatus;
  pausedAt: string | null;        // ISO
  totalPausedDuration: number;    // ms
}

// ─── Dashboard / Calculation Helpers ─────────────────────────────────────────

export interface AttendanceCalc {
  totalInTimeMs: number;
  workingMs: number;       // totalInTime − breaks
  remainingMs: number;
  overtimeMs: number;
  breakUsedMs: number;
  breakRemainingMs: number;
  status: AttendanceStatus;
}
