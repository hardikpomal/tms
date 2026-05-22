"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { formatDuration, FULL_DAY_MS, MAX_BREAK_MS } from '../utils/rules';
import { formatTime } from '../utils/time';
import { Badge } from './ui/badge';
import { Clock, Coffee, TrendingUp, Timer, AlarmClock } from 'lucide-react';
import { addMilliseconds, format } from 'date-fns';
import { EditAttendanceDialog } from './EditAttendanceDialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { getTodayDateString } from '../utils/time';

const statusColors: Record<string, string> = {
  'Full Day': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  'Present': 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  'Half Day': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  'Late Login': 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  'Early Logout': 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  'Overtime': 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
  'Absent': 'bg-muted text-muted-foreground border-border',
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}

export function TodayStatusCard() {
  const { state, calc } = useAttendanceContext();

  const todayRecord = useLiveQuery(() =>
    db.attendance.where('date').equals(getTodayDateString()).first()
  );

  const isClockedOut = !state.isClocked && todayRecord;

  if (!state.isClocked && !state.clockInTime && !todayRecord) {
    // Empty / pre-clocked state
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Today&apos;s Attendance</span>
            <EditAttendanceDialog />
          </div>
          <Badge className="text-xs border bg-muted text-muted-foreground border-border" variant="outline">
            Not Logged In
          </Badge>
        </div>
        
        <div className="p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Clock in to start your work day</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Or click the edit pencil icon above to manually add logs.</p>
        </div>
      </motion.div>
    );
  }

  // Day Ends At: Clock In + 8.5h work + actual Break Taken (pushes end time back dynamically)
  const clockInTimeStr = isClockedOut ? todayRecord.clockIn : state.clockInTime;
  const clockOutTimeStr = isClockedOut ? todayRecord.clockOut : undefined;

  const statusLabel = isClockedOut ? todayRecord.attendanceStatus : (calc?.status ?? 'Present');
  const workingMs = isClockedOut ? (todayRecord.totalHours * 3600000) : (calc?.workingMs ?? 0);
  const breakUsedMs = isClockedOut ? (todayRecord.breakUsed * 60000) : (calc?.breakUsedMs ?? 0);
  const overtimeMs = isClockedOut ? (todayRecord.overtime * 3600000) : (calc?.overtimeMs ?? 0);

  const totalInTimeMs = isClockedOut
    ? (new Date(clockOutTimeStr || clockInTimeStr || '').getTime() - new Date(clockInTimeStr || '').getTime())
    : (calc?.totalInTimeMs ?? 0);

  const remainingMs = isClockedOut ? 0 : (calc?.remainingMs ?? FULL_DAY_MS);
  const breakRemainingMs = isClockedOut ? Math.max(0, MAX_BREAK_MS - breakUsedMs) : (calc?.breakRemainingMs ?? MAX_BREAK_MS);

  const dayEndAt = clockInTimeStr
    ? format(addMilliseconds(new Date(clockInTimeStr), FULL_DAY_MS + breakUsedMs), 'hh:mm:ss a')
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Today&apos;s Attendance</span>
          <EditAttendanceDialog />
          {state.onBreak && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium animate-pulse">
              On Break
            </span>
          )}
        </div>
        <Badge className={`text-xs border ${statusColors[statusLabel] ?? statusColors['Present']}`} variant="outline">
          {statusLabel}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border/30">
        {[
          { label: 'Clock In', value: clockInTimeStr ? formatTime(clockInTimeStr) : '—', icon: LogInIcon },
          { label: 'Day Ends At', value: dayEndAt, icon: AlarmClock, accent: remainingMs === 0 ? 'text-emerald-500' : undefined },
          { label: 'Total In-Time', value: formatDuration(totalInTimeMs), icon: Timer },
          { label: 'Working Time', value: formatDuration(workingMs), icon: TrendingUp, accent: overtimeMs > 0 ? 'text-purple-500' : undefined },
          { label: 'Break Used', value: formatDuration(breakUsedMs), icon: Coffee, accent: breakRemainingMs === 0 ? 'text-red-500' : 'text-amber-500' },
          { label: 'Remaining', value: formatDuration(remainingMs), icon: Clock, accent: remainingMs === 0 ? 'text-emerald-500' : undefined },
        ].map(({ label, value, icon: Ic, accent }) => (
          <div key={label} className="flex flex-col gap-2 px-4 py-3 bg-card">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
            <div className="flex items-center gap-1.5">
              {Ic && <Ic className={`h-3.5 w-3.5 ${accent ?? 'text-muted-foreground'}`} />}
              <span className={`font-mono font-semibold text-sm tabular-nums ${accent ?? ''}`}>{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 py-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Work Progress</span>
            <span>{Math.min(100, Math.round((workingMs / FULL_DAY_MS) * 100))}%</span>
          </div>
          <ProgressBar value={workingMs} max={FULL_DAY_MS} color="bg-emerald-500" />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Break Used</span>
            <span>{Math.min(100, Math.round((breakUsedMs / MAX_BREAK_MS) * 100))}%</span>
          </div>
          <ProgressBar value={breakUsedMs} max={MAX_BREAK_MS} color="bg-amber-500" />
        </div>
      </div>
    </motion.div>
  );
}

// Inline icon component to avoid import issues
function LogInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}
