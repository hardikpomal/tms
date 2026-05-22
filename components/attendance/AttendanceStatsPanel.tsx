"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { User, Info } from 'lucide-react';
import { useAttendanceContext } from '../../contexts/AttendanceContext';
import { formatDuration, FULL_DAY_MS } from '../../utils/rules';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../database/db';

export function AttendanceStatsPanel() {
  const { state, calc } = useAttendanceContext();
  
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch the last 30 days of history from Dexie DB
  const dbRecords = useLiveQuery(() => 
    db.attendance.orderBy('date').reverse().limit(30).toArray()
  , []);

  // Calculate the average effective hours dynamically across all days with logged activity
  const avgHrs = React.useMemo(() => {
    if (!dbRecords || dbRecords.length === 0) return '0h 0m';
    
    let totalWorkingMs = 0;
    let daysCount = 0;
    const todayStr = format(now, 'yyyy-MM-dd');
    const nowMs = now.getTime();

    dbRecords.forEach(record => {
      const isToday = record.date === todayStr;
      
      let workingMs = 0;
      if (isToday && state.isClocked && calc) {
        workingMs = calc.workingMs;
      } else if (record.clockIn) {
        const clockInMs = new Date(record.clockIn).getTime();
        const clockOutMs = record.clockOut ? new Date(record.clockOut).getTime() : nowMs;
        const totalInTimeMs = Math.max(0, clockOutMs - clockInMs);
        
        let breakMs = 0;
        if (record.breaks && record.breaks.length > 0) {
          record.breaks.forEach(b => {
            const bStart = new Date(b.start).getTime();
            const bEnd = b.end ? new Date(b.end).getTime() : nowMs;
            breakMs += Math.max(0, bEnd - bStart);
          });
        } else {
          breakMs = record.breakUsed * 60000;
        }
        workingMs = Math.max(0, totalInTimeMs - breakMs);
      } else {
        workingMs = record.totalHours * 3600000;
      }

      if (workingMs > 0) {
        totalWorkingMs += workingMs;
        daysCount += 1;
      }
    });

    if (daysCount === 0) return '0h 0m';

    const avgMs = totalWorkingMs / daysCount;
    const totalSeconds = Math.floor(avgMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
  }, [dbRecords, state.isClocked, calc, now]);

  const workingMs = calc?.workingMs ?? 0;
  const breakUsedMs = calc?.breakUsedMs ?? 0;
  
  const workPct = Math.min(100, Math.round((workingMs / FULL_DAY_MS) * 100));
  const breakPct = Math.min(100, Math.round((breakUsedMs / FULL_DAY_MS) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Attendance Stats */}
      <Card className="bg-card border-border/50 shadow-sm flex flex-col">
        <CardHeader className="pb-2 border-b border-border/30">
          <CardTitle className="text-sm font-medium">Attendance Stats</CardTitle>
        </CardHeader>
        <CardContent className="p-5 flex-1 flex flex-col justify-center space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <span className="font-medium text-sm">Me</span>
            </div>
            
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="text-lg font-bold tracking-tight text-primary font-mono tabular-nums">{format(now, 'hh:mm:ss a')}</div>
              <div className="text-[10px] text-muted-foreground">{format(now, 'EEE, dd MMM yyyy')}</div>
            </div>

            <div className="flex flex-col items-center sm:items-end justify-center shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 justify-center sm:justify-end select-none">
                Avg hrs / day <Info className="h-3 w-3 text-muted-foreground/60" />
              </div>
              <div className="font-semibold text-sm sm:text-base font-mono">{avgHrs}</div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Timings */}
      <Card className="bg-card border-border/50 shadow-sm flex flex-col">
        <CardHeader className="pb-2 border-b border-border/30">
          <CardTitle className="text-sm font-medium">Timings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex gap-1.5 mb-4">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div 
                key={i} 
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                  i === 3 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Today (Flexible Timings)</span>
              <span>{formatDuration(workingMs)}</span>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
              {/* Fake visual breakdown of the day into chunks for realism */}
              <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, workPct - breakPct)}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${breakPct}%` }} />
              <div className="h-full bg-emerald-500" style={{ width: `${breakPct > 0 ? breakPct : 0}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Duration: {calc ? formatDuration(calc.totalInTimeMs) : '00:00:00'}</span>
              <span>Break: {formatDuration(breakUsedMs)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
