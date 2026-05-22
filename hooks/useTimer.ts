"use client";

import { useState, useEffect } from 'react';
import { TimerState, TaskStatus } from '../types';
import { differenceInMilliseconds, parseISO } from 'date-fns';
import { db } from '../database/db';
import { msToHours } from '../utils/rules';
import { getTodayDateString } from '../utils/time';

const STORAGE_KEY = 'tms_timer_state';

const defaultState: TimerState = {
  isRunning: false,
  startTime: null,
  project: '',
  description: '',
  status: 'In Progress',
  pausedAt: null,
  totalPausedDuration: 0,
};

/** Read persisted timer state synchronously so the first render is already correct */
function readTimerStorage(): TimerState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) as TimerState };
  } catch {}
  return defaultState;
}

export function useTimer() {
  // Lazy initializer — reads localStorage on the very first render (no race condition)
  const [state, setState] = useState<TimerState>(readTimerStorage);
  const [tick, setTick] = useState(0); // 1-second ticker

  // ─── Persist to localStorage whenever state changes ──────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // ─── 1-second tick (only when running) ──────────────────────────────────
  useEffect(() => {
    if (!state.isRunning || !state.startTime || state.pausedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.isRunning, state.startTime, state.pausedAt]);

  // ─── Derived running duration (no setState in effect) ───────────────────
  let runningDuration = 0;
  if (state.startTime) {
    if (state.isRunning && !state.pausedAt) {
      runningDuration = Math.max(
        0,
        differenceInMilliseconds(new Date(), parseISO(state.startTime)) - state.totalPausedDuration,
      );
    } else if (state.pausedAt) {
      runningDuration = Math.max(
        0,
        differenceInMilliseconds(parseISO(state.pausedAt), parseISO(state.startTime)) - state.totalPausedDuration,
      );
    }
  }

  // ─── Controls ───────────────────────────────────────────────────────────
  const updateField = <K extends keyof TimerState>(field: K, value: TimerState[K]) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const startTimer = (attendanceId: number) => {
    if (!state.project.trim()) return false;
    setState((prev) => ({
      ...prev,
      isRunning: true,
      startTime: new Date().toISOString(),
      pausedAt: null,
      totalPausedDuration: 0,
      status: 'In Progress',
    }));
    return true;
  };

  const pauseTimer = () => {
    if (!state.isRunning) return;
    setState((prev) => ({
      ...prev,
      isRunning: false,
      pausedAt: new Date().toISOString(),
      status: 'On Hold',
    }));
  };

  const resumeTimer = () => {
    if (state.isRunning || !state.pausedAt) return;
    const additionalPaused = differenceInMilliseconds(new Date(), parseISO(state.pausedAt));
    setState((prev) => ({
      ...prev,
      isRunning: true,
      pausedAt: null,
      totalPausedDuration: prev.totalPausedDuration + additionalPaused,
      status: 'In Progress',
    }));
  };

  /** Stops the timer, saves to Dexie, returns the saved record */
  const stopTimer = async (attendanceId: number) => {
    if (!state.startTime) return null;
    const endTime = new Date().toISOString();
    const effectiveEnd = state.pausedAt ?? endTime;
    const totalMs =
      differenceInMilliseconds(parseISO(effectiveEnd), parseISO(state.startTime)) -
      state.totalPausedDuration;

    const record = {
      attendanceId,
      project: state.project,
      description: state.description,
      startTime: state.startTime,
      endTime: effectiveEnd,
      totalHours: msToHours(Math.max(0, totalMs)),
      status: 'Completed' as TaskStatus,
    };

    await db.tasks.add({ ...record, date: getTodayDateString() } as any);
    setState(defaultState);
    return record;
  };

  return {
    state,
    runningDuration,
    updateField,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
  };
}
