"use client";

/**
 * TimerContext — single source of truth for the active task timer.
 * Prevents multiple components (TimerWidget, DashboardCards) from each
 * holding their own isolated timer state.
 */

import React, { createContext, useContext, useEffect } from 'react';
import { useTimer } from '../hooks/useTimer';
import { useAttendanceContext } from './AttendanceContext';

type TimerCtx = ReturnType<typeof useTimer>;

const TimerContext = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = useTimer();
  const attendance = useAttendanceContext();

  const { state: timerState, resetTimer } = timer;

  useEffect(() => {
    // If clocked out, ensure no active timer state remains in localStorage
    if (!attendance.state.isClocked && timerState.startTime) {
      console.log("[TimerProvider] Stale task timer detected while clocked out. Resetting timer.");
      resetTimer();
    }
  }, [attendance.state.isClocked, timerState.startTime, resetTimer]);

  return (
    <TimerContext.Provider value={timer}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext(): TimerCtx {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimerContext must be used inside <TimerProvider>');
  return ctx;
}
