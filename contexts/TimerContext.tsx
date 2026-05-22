"use client";

/**
 * TimerContext — single source of truth for the active task timer.
 * Prevents multiple components (TimerWidget, DashboardCards) from each
 * holding their own isolated timer state.
 */

import React, { createContext, useContext } from 'react';
import { useTimer } from '../hooks/useTimer';

type TimerCtx = ReturnType<typeof useTimer>;

const TimerContext = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = useTimer();
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
