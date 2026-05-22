"use client";

import { useState, useEffect, useCallback } from 'react';
import { AttendanceState, AttendanceCalc, AttendanceStatus } from '../types';
import {
  FULL_DAY_MS, HALF_DAY_MS, MAX_BREAK_MS,
  LATE_LOGIN_THRESHOLD_MINUTES, WORK_DAY_START_HOUR, WORK_DAY_START_MINUTE,
  msToHours,
} from '../utils/rules';
import { db } from '../database/db';
import { getTodayDateString } from '../utils/time';

const STORAGE_KEY = 'tms_attendance_state';

const defaultState: AttendanceState = {
  attendanceId: null,
  clockInTime: null,
  isClocked: false,
  onBreak: false,
  breakStartTime: null,
  totalBreakMs: 0,
  breakHistory: [],
};

// ─── Derive attendance status from working ms ─────────────────────────────
function deriveStatus(workingMs: number, clockInTime: string): AttendanceStatus {
  const clockIn = new Date(clockInTime);
  const expectedStart = new Date(clockIn);
  expectedStart.setHours(WORK_DAY_START_HOUR, WORK_DAY_START_MINUTE, 0, 0);
  const lateThresholdMs = LATE_LOGIN_THRESHOLD_MINUTES * 60 * 1000;
  const isLate = clockIn.getTime() - expectedStart.getTime() > lateThresholdMs;

  if (workingMs >= FULL_DAY_MS) return 'Full Day';
  if (workingMs >= HALF_DAY_MS) return isLate ? 'Late Login' : 'Present';
  if (workingMs > 0) return 'Half Day';
  return 'Absent';
}

// ─── Calculate live attendance metrics ───────────────────────────────────────
export function calcAttendance(
  clockInTime: string,
  nowMs: number,
  totalBreakMs: number,
  onBreak: boolean,
  breakStartTime: string | null,
): AttendanceCalc {
  const clockIn = new Date(clockInTime).getTime();
  let currentBreakMs = 0;
  if (onBreak && breakStartTime) {
    currentBreakMs = nowMs - new Date(breakStartTime).getTime();
  }
  const accBreakMs = totalBreakMs + currentBreakMs;
  const breakUsedMs = accBreakMs;
  const breakRemainingMs = MAX_BREAK_MS - accBreakMs;
  const totalInTimeMs = Math.max(0, nowMs - clockIn);
  const workingMs = Math.max(0, totalInTimeMs - accBreakMs);
  const remainingMs = Math.max(0, FULL_DAY_MS - workingMs);
  const overtimeMs = workingMs > FULL_DAY_MS ? workingMs - FULL_DAY_MS : 0;

  return {
    totalInTimeMs,
    workingMs,
    remainingMs,
    overtimeMs,
    breakUsedMs,
    breakRemainingMs,
    status: deriveStatus(workingMs, clockInTime),
  };
}

/** Read persisted attendance state synchronously so the first render is already correct */
function readAttendanceStorage(): AttendanceState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) as AttendanceState };
  } catch {}
  return defaultState;
}

export function useAttendance() {
  // Lazy initializer — reads localStorage on the very first render (no race condition)
  const [state, setState] = useState<AttendanceState>(readAttendanceStorage);
  const [nowTime, setNowTime] = useState(() => Date.now()); // drives live re-render every second with pure React state

  // ─── Persist state to localStorage ─────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // ─── 1-second tick for live timer ────────────────────────────────────────
  useEffect(() => {
    if (!state.isClocked) return;
    const id = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.isClocked]);

  // ─── Derived live calculations ────────────────────────────────────────────
  const calc: AttendanceCalc | null = state.isClocked && state.clockInTime
    ? calcAttendance(state.clockInTime, nowTime, state.totalBreakMs, state.onBreak, state.breakStartTime)
    : null;

  // ─── Clock In ────────────────────────────────────────────────────────────
  const clockIn = useCallback(async () => {
    const now = new Date().toISOString();
    const today = getTodayDateString();

    // Check if already clocked in today
    const existing = await db.attendance.where('date').equals(today).first();
    if (existing?.id) {
      // Resume from DB (page refresh case is handled via localStorage)
      queueMicrotask(() => {
        setNowTime(Date.now());
        setState({
          attendanceId: existing.id!,
          clockInTime: existing.clockIn,
          isClocked: !existing.clockOut,
          onBreak: false,
          breakStartTime: null,
          totalBreakMs: (existing.breakUsed || 0) * 60 * 1000,
          breakHistory: existing.breaks || [],
        });
      });
      return;
    }

    // Create new attendance record
    const id = await db.attendance.add({
      date: today,
      clockIn: now,
      totalHours: 0,
      breakUsed: 0,
      overtime: 0,
      attendanceStatus: 'Present',
      breaks: [],
    });

    queueMicrotask(() => {
      setNowTime(Date.now());
      setState({
        attendanceId: id as number,
        clockInTime: now,
        isClocked: true,
        onBreak: false,
        breakStartTime: null,
        totalBreakMs: 0,
        breakHistory: [],
      });
    });
  }, []);

  // ─── Clock Out ───────────────────────────────────────────────────────────
  const clockOut = useCallback(async () => {
    if (!state.attendanceId || !state.clockInTime) return null;

    const now = new Date().toISOString();
    const finalCalc = calcAttendance(
      state.clockInTime,
      Date.now(),
      state.totalBreakMs,
      false,
      null,
    );

    await db.attendance.update(state.attendanceId, {
      clockOut: now,
      totalHours: msToHours(finalCalc.workingMs),
      breakUsed: Math.floor(finalCalc.breakUsedMs / 60000),
      overtime: msToHours(finalCalc.overtimeMs),
      attendanceStatus: finalCalc.status,
      breaks: state.breakHistory,
    });

    queueMicrotask(() => setState(defaultState));
    return finalCalc;
  }, [state]);

  // ─── Start Break ─────────────────────────────────────────────────────────
  const startBreak = useCallback(() => {
    if (!state.isClocked || state.onBreak) return;
    setState((prev) => ({
      ...prev,
      onBreak: true,
      breakStartTime: new Date().toISOString(),
      breakHistory: [...(prev.breakHistory || []), { start: new Date().toISOString() }],
    }));
  }, [state.isClocked, state.onBreak]);

  // ─── End Break ───────────────────────────────────────────────────────────
  const endBreak = useCallback(() => {
    if (!state.onBreak || !state.breakStartTime) return;
    const breakMs = Date.now() - new Date(state.breakStartTime).getTime();
    
    setState((prev) => {
      const updatedHistory = [...(prev.breakHistory || [])];
      if (updatedHistory.length > 0) {
        updatedHistory[updatedHistory.length - 1].end = new Date().toISOString();
      }
      return {
        ...prev,
        onBreak: false,
        breakStartTime: null,
        totalBreakMs: prev.totalBreakMs + breakMs,
        breakHistory: updatedHistory,
      };
    });
  }, [state.onBreak, state.breakStartTime]);

  return {
    state,
    calc,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
  };
}
