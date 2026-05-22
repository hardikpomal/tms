"use client";

import { useEffect } from 'react';
import { db } from '../database/db';
import { toast } from 'sonner';
import { msToHours } from '../utils/rules';
import { AttendanceRecord, AttendanceStatus, AttendanceState } from '../types';

const CORRECTION_KEY = 'tms_break_correction_1202_1222_v2';
const BREAK_START_ISO = new Date("2026-05-22T12:02:10+05:30").toISOString(); // "2026-05-22T06:32:10.000Z"
const BREAK_END_ISO = new Date("2026-05-22T12:22:23+05:30").toISOString(); // "2026-05-22T06:52:23.000Z"
const TARGET_CLOCK_IN_ISO = new Date("2026-05-22T10:35:56+05:30").toISOString(); // "2026-05-22T05:05:56.000Z"
const BREAK_MS = 1213000; // 20m 13s
const BREAK_MINS = 20;

export function BreakCorrector() {
  useEffect(() => {
    async function applyCorrection() {
      // 1. Check if already applied
      if (localStorage.getItem(CORRECTION_KEY) === 'applied') {
        return;
      }

      console.log("[BreakCorrector] Applying break and clock-in alignment to 10:35:56 AM...");
      let changesMade = false;

      // 2. Adjust Today's Attendance Record in Dexie
      const today = "2026-05-22";
      const record = await db.attendance.where('date').equals(today).first();

      if (record && record.id) {
        const updatePayload: Partial<AttendanceRecord> = {};
        
        // A. Verify and fix Clock-In Time
        if (record.clockIn !== TARGET_CLOCK_IN_ISO) {
          updatePayload.clockIn = TARGET_CLOCK_IN_ISO;
          changesMade = true;
        }

        // B. Verify and insert Missed Break
        const currentBreaks = record.breaks || [];
        const breakExists = currentBreaks.some(b => b.start === BREAK_START_ISO);
        let finalBreaks = currentBreaks;
        let finalBreakUsed = record.breakUsed || 0;

        if (!breakExists) {
          finalBreaks = [...currentBreaks, { start: BREAK_START_ISO, end: BREAK_END_ISO }];
          finalBreakUsed = (record.breakUsed || 0) + BREAK_MINS;
          updatePayload.breaks = finalBreaks;
          updatePayload.breakUsed = finalBreakUsed;
          changesMade = true;
        }

        // C. If clocked out, adjust totalHours and overtime based on new breaks & clock-in
        if (record.clockOut || Object.keys(updatePayload).length > 0) {
          const clockInTime = new Date(TARGET_CLOCK_IN_ISO).getTime();
          const clockOutTime = record.clockOut ? new Date(record.clockOut).getTime() : Date.now();
          const totalInTimeMs = clockOutTime - clockInTime;
          const totalBreakMs = finalBreakUsed * 60 * 1000;
          const workingMs = Math.max(0, totalInTimeMs - totalBreakMs);
          
          if (record.clockOut) {
            updatePayload.totalHours = msToHours(workingMs);
            const FULL_DAY_MS = 8.5 * 60 * 60 * 1000;
            updatePayload.overtime = workingMs > FULL_DAY_MS ? msToHours(workingMs - FULL_DAY_MS) : 0;
            
            // Recalculate status
            const expectedStart = new Date(TARGET_CLOCK_IN_ISO);
            expectedStart.setHours(9, 30, 0, 0); // WORK_DAY_START_HOUR, WORK_DAY_START_MINUTE
            const isLate = clockInTime - expectedStart.getTime() > 15 * 60 * 1000; // 15 mins late threshold
            
            let status: AttendanceStatus = 'Present';
            if (workingMs >= FULL_DAY_MS) status = 'Full Day';
            else if (workingMs >= 4.5 * 60 * 60 * 1000) status = isLate ? 'Late Login' : 'Present';
            else if (workingMs > 0) status = 'Half Day';
            else status = 'Absent';
            
            updatePayload.attendanceStatus = status;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await db.attendance.update(record.id, updatePayload);
          console.log("[BreakCorrector] Updated today's IndexedDB attendance record successfully.");
        }
      }

      // 3. Adjust Active Session State in LocalStorage
      const attStateRaw = localStorage.getItem('tms_attendance_state');
      if (attStateRaw) {
        try {
          const attState = JSON.parse(attStateRaw) as AttendanceState;
          // Only modify if it is clocked in today
          if (attState.isClocked && attState.clockInTime) {
            const isToday = attState.clockInTime.startsWith(today);
            if (isToday) {
              let attStateChanged = false;

              // A. Correct Clock-In
              if (attState.clockInTime !== TARGET_CLOCK_IN_ISO) {
                attState.clockInTime = TARGET_CLOCK_IN_ISO;
                attStateChanged = true;
              }

              // B. Correct Break
              const currentHistory = attState.breakHistory || [];
              const breakExists = currentHistory.some(b => b.start === BREAK_START_ISO);
              
              if (!breakExists) {
                attState.breakHistory = [...currentHistory, { start: BREAK_START_ISO, end: BREAK_END_ISO }];
                attState.totalBreakMs = (attState.totalBreakMs || 0) + BREAK_MS;
                attStateChanged = true;
              }

              if (attStateChanged) {
                localStorage.setItem('tms_attendance_state', JSON.stringify(attState));
                changesMade = true;
                console.log("[BreakCorrector] Updated tms_attendance_state in localStorage.");
              }
            }
          }
        } catch (e) {
          console.error("[BreakCorrector] Error parsing attendance state", e);
        }
      }

      // 4. Adjust Active Task Timer in LocalStorage (if any)
      const timerStateRaw = localStorage.getItem('tms_timer_state');
      if (timerStateRaw) {
        try {
          const timerState = JSON.parse(timerStateRaw);
          if (timerState.isRunning && timerState.startTime) {
            const timerStart = new Date(timerState.startTime).getTime();
            const breakEnd = new Date(BREAK_END_ISO).getTime();
            // If the timer started before the break ended, they were working on a task when they took a break
            if (timerStart < breakEnd) {
              // Add break duration to totalPausedDuration so it doesn't count as work
              timerState.totalPausedDuration = (timerState.totalPausedDuration || 0) + BREAK_MS;
              localStorage.setItem('tms_timer_state', JSON.stringify(timerState));
              changesMade = true;
              console.log("[BreakCorrector] Adjusted active task timer paused duration in localStorage.");
            }
          }
        } catch (e) {
          console.error("[BreakCorrector] Error parsing timer state", e);
        }
      }

      // 5. Adjust saved tasks in Dexie that overlap with the break
      if (record && record.id) {
        const tasks = await db.tasks.where('attendanceId').equals(record.id).toArray();
        const breakStart = new Date(BREAK_START_ISO).getTime();
        const breakEnd = new Date(BREAK_END_ISO).getTime();

        for (const task of tasks) {
          if (task.startTime && task.id) {
            const taskStart = new Date(task.startTime).getTime();
            const taskEnd = task.endTime ? new Date(task.endTime).getTime() : Date.now();

            // Calculate overlap
            const overlapStart = Math.max(taskStart, breakStart);
            const overlapEnd = Math.min(taskEnd, breakEnd);

            if (overlapStart < overlapEnd) {
              const overlapMs = overlapEnd - overlapStart;
              // Calculate new duration
              const currentTaskMs = (task.totalHours || 0) * 3600 * 1000;
              const newTasksMs = Math.max(0, currentTaskMs - overlapMs);
              
              await db.tasks.update(task.id, {
                totalHours: msToHours(newTasksMs)
              });
              changesMade = true;
              console.log(`[BreakCorrector] Adjusted task ${task.id} (${task.project}) by subtracting overlap of ${overlapMs / 1000}s.`);
            }
          }
        }
      }

      // 6. Mark correction as applied
      localStorage.setItem(CORRECTION_KEY, 'applied');

      // 7. Show user-friendly toast and refresh state if changes were made
      if (changesMade) {
        toast.success("Times Synced! Clock-in aligned to 10:35:56 AM and breaks updated.", {
          duration: 6000,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }

    applyCorrection();
  }, []);

  return null;
}
