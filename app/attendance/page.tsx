"use client";

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../database/db';
import { AttendanceStatsPanel } from '../../components/attendance/AttendanceStatsPanel';
import { AttendanceLogTable } from '../../components/attendance/AttendanceLogTable';
import { AttendanceCalendar } from '../../components/attendance/AttendanceCalendar';
import { subDays, format } from 'date-fns';
import { AttendanceRecord } from '../../types';
import { useAttendanceContext } from '../../contexts/AttendanceContext';
import { msToHours } from '../../utils/rules';

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function AttendancePage() {
  const { state: attState, calc } = useAttendanceContext();
  
  // Fetch up to 30 days of history from Dexie
  const dbRecords = useLiveQuery(() => 
    db.attendance.orderBy('date').reverse().limit(30).toArray()
  , []);

  // Guarantee we have exactly 30 days of history backwards from today to match Keka's strict view
  // If a day doesn't exist in the DB, we generate an empty placeholder for it.
  const records = useMemo(() => {
    const today = new Date();
    const timeline: AttendanceRecord[] = [];
    const dbMap = new Map((dbRecords || []).map(r => [r.date, r]));

    for (let i = 0; i < 30; i++) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      
      if (dbMap.has(dateStr)) {
        const dbRec = { ...dbMap.get(dateStr)! };
        // If it's today and we are clocked in, inject the live calc data so it doesn't show 0h 0m!
        if (i === 0 && attState.isClocked && calc) {
          dbRec.totalHours = msToHours(calc.workingMs);
          dbRec.breakUsed = Math.floor(calc.breakUsedMs / 60000);
          dbRec.breaks = attState.breakHistory;
          dbRec.clockIn = attState.clockInTime || dbRec.clockIn;
          dbRec.clockOut = undefined;
        }
        timeline.push(dbRec);
      } else {
        if (i === 0 && attState.isClocked && calc) {
          timeline.push({
            id: 0,
            date: dateStr,
            clockIn: attState.clockInTime || new Date().toISOString(),
            clockOut: '',
            totalHours: msToHours(calc.workingMs),
            breakUsed: Math.floor(calc.breakUsedMs / 60000),
            overtime: 0,
            attendanceStatus: 'Present',
            breaks: attState.breakHistory
          });
        } else {
          timeline.push({
            id: -i, // Fake ID
            date: dateStr,
            clockIn: '',
            clockOut: '',
            totalHours: 0,
            breakUsed: 0,
            overtime: 0,
            attendanceStatus: 'Absent'
          });
        }
      }
    }
    return timeline;
  }, [dbRecords, attState.isClocked, attState.clockInTime, attState.breakHistory, calc]);


  const [activeSubTab, setActiveSubTab] = useState<'log' | 'calendar'>('log');

  return (
    <div className="bg-background transition-colors duration-300 min-h-screen">
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header matches Dashboard */}
        <motion.header {...fadeUp} className="flex flex-col gap-1 mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        </motion.header>

        {/* Top Keka-style widgets */}
        <motion.section {...fadeUp} transition={{ delay: 0.05 }}>
          <AttendanceStatsPanel />
        </motion.section>

        {/* Bottom Keka-style table / calendar */}
        <motion.section {...fadeUp} transition={{ delay: 0.1 }}>
          <div className="flex gap-4 border-b border-border/50 mb-4 px-2">
            <button
              onClick={() => setActiveSubTab('log')}
              className={`text-sm font-medium pb-2 border-b-2 transition-all outline-none bg-transparent ${
                activeSubTab === 'log'
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Attendance Log
            </button>
            <button
              onClick={() => setActiveSubTab('calendar')}
              className={`text-sm font-medium pb-2 border-b-2 transition-all outline-none bg-transparent ${
                activeSubTab === 'calendar'
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Calendar
            </button>
          </div>
          {activeSubTab === 'log' ? (
            <AttendanceLogTable records={records} />
          ) : (
            <AttendanceCalendar records={records} />
          )}
        </motion.section>

      </div>
    </div>
  );
}
