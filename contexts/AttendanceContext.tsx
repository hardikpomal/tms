"use client";

/**
 * AttendanceContext — single source of truth for attendance state.
 * Wrap the app with <AttendanceProvider> so every component shares
 * one useAttendance() instance instead of isolated per-component state.
 */

import React, { createContext, useContext } from 'react';
import { useAttendance } from '../hooks/useAttendance';

type AttendanceCtx = ReturnType<typeof useAttendance>;

const AttendanceContext = createContext<AttendanceCtx | null>(null);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const attendance = useAttendance();
  return (
    <AttendanceContext.Provider value={attendance}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendanceContext(): AttendanceCtx {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendanceContext must be used inside <AttendanceProvider>');
  return ctx;
}
