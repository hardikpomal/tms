"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, Coffee } from 'lucide-react';
import { Button } from './ui/button';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { useTimerContext } from '../contexts/TimerContext';
import { formatDuration, formatHoursMinutes } from '../utils/rules';
import { formatTime } from '../utils/time';
import { toast } from 'sonner';

export function AttendancePanel({ onClockIn }: { onClockIn?: () => void }) {
  const { state, calc, clockIn, clockOut, startBreak, endBreak } = useAttendanceContext();
  const timer = useTimerContext();

  const handleClockIn = async () => {
    await clockIn();
    toast.success('Good morning! Clock-in recorded.', { description: new Date().toLocaleTimeString() });
    onClockIn?.();
  };

  const handleClockOut = async () => {
    if (!confirm('Are you sure you want to Clock Out for today?')) return;

    // Auto-stop active task timer if running or paused before clocking out
    if (timer.state.startTime && state.attendanceId) {
      await timer.stopTimer(state.attendanceId);
    }

    const result = await clockOut();
    if (result) {
      toast.success('Clocked out successfully!', {
        description: `You worked ${formatHoursMinutes(result.workingMs)} today.`,
      });
    }
  };

  const handleBreak = () => {
    if (state.onBreak) {
      endBreak();
      toast.info('Break ended. Back to work!');
    } else {
      // Auto-pause the active task timer if it's currently running
      if (timer.state.isRunning) {
        timer.pauseTimer();
        toast.info('Active task paused.');
      }
      startBreak();
      toast.info('Break started. Take a rest!');
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {!state.isClocked ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            onClick={handleClockIn}
            className="h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
          >
            <LogIn className="h-4 w-4" />
            Clock In
          </Button>
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 flex-wrap"
          >
            {/* Live office timer */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {calc ? formatDuration(calc.totalInTimeMs) : '00:00:00'}
              </span>
              <span className="text-xs text-muted-foreground">
                {state.clockInTime ? `Since ${formatTime(state.clockInTime)}` : ''}
              </span>
            </div>

            {/* Break button */}
            <Button
              onClick={handleBreak}
              variant="outline"
              size="sm"
              className={`h-9 rounded-xl gap-2 transition-all hover:scale-105 ${
                state.onBreak
                  ? 'border-amber-500/50 text-amber-600 bg-amber-500/10 dark:text-amber-400'
                  : ''
              }`}
            >
              <Coffee className="h-4 w-4" />
              {state.onBreak ? 'End Break' : 'Take Break'}
            </Button>

            {/* Clock out */}
            <Button
              onClick={handleClockOut}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-all hover:scale-105"
            >
              <LogOut className="h-4 w-4" />
              Clock Out
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
