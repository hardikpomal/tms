"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../database/db';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { useAttendanceContext } from '../../contexts/AttendanceContext';
import { 
  format, 
  parseISO, 
  isWeekend, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay, 
  startOfWeek, 
  endOfWeek,
  addDays,
  isSameDay
} from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Coffee, 
  Timer, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

interface AttendanceCalendarProps {
  records: AttendanceRecord[];
}

export function AttendanceCalendar({ records: propRecords }: AttendanceCalendarProps) {
  const { state: attState, calc } = useAttendanceContext();
  const [activeTab, setActiveTab] = useState('30 DAYS');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());

  // Keep live time ticking for active today's calculations
  useEffect(() => {
    const hasActiveSession = propRecords.some(r => r.clockIn && !r.clockOut);
    if (!hasActiveSession) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [propRecords]);

  // Fetch full history from Dexie so we can show older months perfectly
  const dbRecords = useLiveQuery(() => db.attendance.toArray(), []);

  // Generate the last 6 months dynamically for the tabs
  const tabs = ['30 DAYS'];
  for (let i = 0; i < 6; i++) {
    tabs.push(format(subMonths(new Date(), i), 'MMM').toUpperCase());
  }

  // Merge database records with live context today record
  const allRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    
    // Add all historical db records
    if (dbRecords) {
      dbRecords.forEach(r => map.set(r.date, r));
    }

    // Always ensure today's live details are up to date in the calendar
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (map.has(todayStr)) {
      const todayRec = { ...map.get(todayStr)! };
      if (attState.isClocked && calc) {
        todayRec.clockIn = attState.clockInTime || todayRec.clockIn;
        todayRec.breaks = attState.breakHistory;
        todayRec.clockOut = undefined;
      }
      map.set(todayStr, todayRec);
    } else if (attState.isClocked) {
      // If today is not in DB yet but we are clocked in
      map.set(todayStr, {
        date: todayStr,
        clockIn: attState.clockInTime || new Date().toISOString(),
        totalHours: 0,
        breakUsed: 0,
        overtime: 0,
        attendanceStatus: 'Present',
        breaks: attState.breakHistory
      });
    }

    return map;
  }, [dbRecords, attState.isClocked, attState.breakHistory, calc]);

  // Helper: Get precise working, break, and gross ms for any date
  const getDayDurations = (dateStr: string) => {
    const record = allRecordsMap.get(dateStr);
    let workingMs = 0;
    let breakMs = 0;
    let grossMs = 0;

    if (!record) return { workingMs, breakMs, grossMs, record };

    if (record.clockIn) {
      const clockInMs = new Date(record.clockIn).getTime();
      const clockOutMs = record.clockOut ? new Date(record.clockOut).getTime() : now;
      const totalInTimeMs = Math.max(0, clockOutMs - clockInMs);

      if (record.breaks && record.breaks.length > 0) {
        record.breaks.forEach(b => {
          const bStart = new Date(b.start).getTime();
          const bEnd = b.end ? new Date(b.end).getTime() : now;
          breakMs += Math.max(0, bEnd - bStart);
        });
      } else {
        breakMs = record.breakUsed * 60000;
      }

      workingMs = Math.max(0, totalInTimeMs - breakMs);
      grossMs = totalInTimeMs;
    } else {
      workingMs = record.totalHours * 3600000;
      breakMs = record.breakUsed * 60000;
      grossMs = workingMs + breakMs;
    }

    return { workingMs, breakMs, grossMs, record };
  };

  const formatMsToHms = (ms: number): string => {
    if (ms <= 0) return '0h 0m 0s';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatMsToHm = (ms: number): string => {
    if (ms <= 0) return '0h 0m';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  // Switch month based on tab click
  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (tab === '30 DAYS') {
      setSelectedDate(new Date());
    } else {
      // Find which month this tab belongs to
      const targetMonthIndex = tabs.indexOf(tab) - 1; // 30 DAYS is at index 0
      if (targetMonthIndex >= 0) {
        const d = subMonths(new Date(), targetMonthIndex);
        setSelectedDate(d);
      }
    }
  };

  // Month View calendar cells generator
  const monthCells = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Determine padding before start of month to align correctly in grid
    // getDay returns 0 for Sunday, 1 for Monday, etc. Let's align Mon=0, Tue=1, ..., Sun=6
    const startDay = getDay(monthStart);
    const prefixCount = startDay === 0 ? 6 : startDay - 1;

    const cells: { date: Date; isPlaceholder: boolean }[] = [];
    
    // Previous month placeholders
    for (let i = prefixCount; i > 0; i--) {
      cells.push({
        date: addDays(monthStart, -i),
        isPlaceholder: true
      });
    }

    // Current month days
    days.forEach(d => {
      cells.push({
        date: d,
        isPlaceholder: false
      });
    });

    return cells;
  }, [selectedDate]);

  // Week View days generator
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [selectedDate]);

  // Render Status Dot
  const renderStatusDot = (status: AttendanceStatus | undefined, isWoff: boolean) => {
    if (isWoff) return <span className="h-2 w-2 rounded-full bg-zinc-500 shrink-0" />;
    switch (status) {
      case 'Present':
      case 'Full Day':
        return <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />;
      case 'Late Login':
      case 'Half Day':
        return <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />;
      case 'Absent':
        return <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-zinc-600 shrink-0" />;
    }
  };

  // Render visual segment timeline in Month cell or Week card
  const renderMiniTimeline = (workingMs: number, breakMs: number, grossMs: number) => {
    if (grossMs === 0) return null;
    const fillPct = Math.min(100, (grossMs / 32400000) * 100);
    const breakPct = (breakMs / grossMs) * 100;
    const workPct = 100 - breakPct;

    return (
      <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden flex mt-2">
        <div className="flex h-full w-full" style={{ width: `${fillPct}%` }}>
          <div className="h-full bg-primary" style={{ width: `${workPct}%` }} />
          {breakPct > 0 && <div className="h-full bg-amber-500/80" style={{ width: `${breakPct}%` }} />}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card border-border/50 shadow-sm overflow-hidden">
      {/* Dynamic Header */}
      <div className="px-5 py-4 border-b border-border/30 bg-muted/10 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation & View Mode Selection */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setSelectedDate(prev => addDays(prev, viewMode === 'month' ? -30 : viewMode === 'week' ? -7 : -1))}
              className="p-1.5 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold whitespace-nowrap min-w-[120px] text-center">
              {viewMode === 'month' 
                ? format(selectedDate, 'MMMM yyyy') 
                : viewMode === 'week' 
                ? `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd MMM')}`
                : format(selectedDate, 'EEE, dd MMM yyyy')
              }
            </span>
            <button 
              onClick={() => setSelectedDate(prev => addDays(prev, viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : 1))}
              className="p-1.5 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex bg-muted/30 p-1 rounded-lg border border-border/20 text-xs">
            <button 
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded transition-all ${viewMode === 'day' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Day
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded transition-all ${viewMode === 'week' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Week
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded transition-all ${viewMode === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Dynamic Month Selector Tabs matching log table */}
        <div className="flex gap-2 text-xs font-medium w-full md:w-auto overflow-x-auto justify-end">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`px-3 py-1.5 rounded-sm transition-colors shrink-0 ${
                activeTab === tab 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* View Container */}
      <div className="p-5">
        
        {/* ========================================================================= */}
        {/* MONTH VIEW                                                                */}
        {/* ========================================================================= */}
        {viewMode === 'month' && (
          <div className="space-y-2">
            {/* Days of the Week Grid Headers */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div className="text-zinc-500">Sat</div>
              <div className="text-zinc-500">Sun</div>
            </div>

            {/* Monthly Day Cards Grid */}
            <div className="grid grid-cols-7 gap-2">
              {monthCells.map((cell, idx) => {
                const dateStr = format(cell.date, 'yyyy-MM-dd');
                const isToday = isSameDay(cell.date, new Date());
                const isWoff = isWeekend(cell.date);
                const { workingMs, breakMs, grossMs, record } = getDayDurations(dateStr);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!cell.isPlaceholder) {
                        setSelectedDate(cell.date);
                        setViewMode('day');
                      }
                    }}
                    className={`min-h-[64px] sm:min-h-[90px] p-1.5 sm:p-2.5 rounded-lg border flex flex-col justify-between transition-all cursor-pointer ${
                      cell.isPlaceholder 
                        ? 'opacity-25 border-transparent bg-transparent pointer-events-none' 
                        : isToday
                        ? 'border-primary bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/20'
                        : isWoff && workingMs === 0
                        ? 'border-border/10 bg-muted/20 hover:bg-muted/30 text-muted-foreground'
                        : 'border-border/40 bg-card hover:border-primary/40 hover:bg-muted/10'
                    }`}
                  >
                    {/* Header: Date and Status Indicator */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isToday ? 'text-primary' : ''}`}>
                        {format(cell.date, 'd')}
                      </span>
                      {record?.clockIn && renderStatusDot(record.attendanceStatus, isWoff && workingMs === 0)}
                      {isWoff && workingMs === 0 && !cell.isPlaceholder && (
                        <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded font-mono hidden sm:inline-block">W.OFF</span>
                      )}
                      {!isWoff && !record?.clockIn && !cell.isPlaceholder && !isToday && (
                        <span className="text-[8px] bg-rose-950/40 text-rose-400 px-1 py-0.5 rounded font-mono hidden sm:inline-block">ABSENT</span>
                      )}
                    </div>

                    {/* Time display */}
                    <div className="mt-1 sm:mt-2 flex-1 flex flex-col justify-end">
                      {workingMs > 0 ? (
                        <div className="space-y-1">
                          <span className="text-[10px] sm:text-[11px] font-bold text-foreground hidden sm:block font-mono truncate">
                            {formatMsToHm(workingMs)}
                          </span>
                          {renderMiniTimeline(workingMs, breakMs, grossMs)}
                        </div>
                      ) : !isWoff && !cell.isPlaceholder && !isToday ? (
                        <span className="text-[10px] text-rose-500 font-semibold hidden sm:inline-block">Absent</span>
                      ) : isWoff && !cell.isPlaceholder && workingMs === 0 ? (
                        <span className="text-[10px] text-zinc-500 hidden sm:inline-block">Weekly off</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* WEEK VIEW                                                                 */}
        {/* ========================================================================= */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, new Date());
              const isWoff = isWeekend(day);
              const { workingMs, breakMs, grossMs, record } = getDayDurations(dateStr);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(day);
                    setViewMode('day');
                  }}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all cursor-pointer min-h-[180px] ${
                    isToday
                      ? 'border-primary bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/20'
                      : isWoff && workingMs === 0
                      ? 'border-border/10 bg-muted/20 hover:bg-muted/30 text-muted-foreground'
                      : 'border-border/40 bg-card hover:border-primary/40 hover:bg-muted/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground">{format(day, 'EEE')}</div>
                        <div className={`text-base font-bold ${isToday ? 'text-primary' : ''}`}>{format(day, 'dd MMM')}</div>
                      </div>
                      {record?.clockIn && renderStatusDot(record.attendanceStatus, isWoff && workingMs === 0)}
                    </div>
                    
                    {isWoff && workingMs === 0 && (
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-zinc-800 text-zinc-400 border-none rounded">W.OFF</Badge>
                    )}
                    {!isWoff && !record?.clockIn && !isToday && (
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-rose-950/40 text-rose-400 border-none rounded">ABSENT</Badge>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {workingMs > 0 ? (
                      <>
                        <div className="text-[13px] font-bold font-mono">
                          {formatMsToHms(workingMs)}
                        </div>
                        {renderMiniTimeline(workingMs, breakMs, grossMs)}
                        <div className="flex gap-2 text-[9px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-0.5"><Coffee className="h-2.5 w-2.5 text-amber-500/80" /> {Math.round(breakMs / 60000)}m</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5 text-primary/60" /> {Math.round(grossMs / 60000)}m</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs font-medium text-muted-foreground">
                        {isWoff ? 'Weekly off' : 'No logs recorded'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DAY VIEW                                                                  */}
        {/* ========================================================================= */}
        {viewMode === 'day' && (() => {
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
          const isToday = isSameDay(selectedDate, new Date());
          const isWoff = isWeekend(selectedDate);
          const { workingMs, breakMs, grossMs, record } = getDayDurations(dateStr);

          const events: { type: 'work' | 'break', start: string, end?: string }[] = [];
          if (record?.breaks && record.breaks.length > 0) {
            let currentMs = new Date(record.clockIn).getTime();
            record.breaks.forEach(b => {
              const bStart = new Date(b.start).getTime();
              if (bStart > currentMs) {
                events.push({ type: 'work', start: new Date(currentMs).toISOString(), end: b.start });
              }
              events.push({ type: 'break', start: b.start, end: b.end });
              if (b.end) {
                currentMs = new Date(b.end).getTime();
              } else {
                currentMs = now;
              }
            });
            const endMs = record.clockOut ? new Date(record.clockOut).getTime() : now;
            if (endMs > currentMs) {
              events.push({ type: 'work', start: new Date(currentMs).toISOString(), end: record.clockOut || undefined });
            }
          } else if (record?.clockIn) {
            events.push({ type: 'work', start: record.clockIn, end: record.clockOut });
          }

          const formatTime = (isoString: string) => {
            try {
              return format(new Date(isoString), 'hh:mm:ss a');
            } catch {
              return isoString;
            }
          };

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Detailed metrics card */}
              <div className="space-y-4">
                <div className="bg-muted/10 p-5 rounded-xl border border-border/20 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Attendance Summary</span>
                    {record?.clockIn && (
                      <Badge className={
                        record.attendanceStatus === 'Present' || record.attendanceStatus === 'Full Day'
                          ? 'bg-emerald-500/10 text-emerald-500 border-none'
                          : 'bg-amber-500/10 text-amber-500 border-none'
                      }>
                        {record.attendanceStatus}
                      </Badge>
                    )}
                    {isWoff && workingMs === 0 && (
                      <Badge className="bg-zinc-800 text-zinc-400 border-none">Weekly Off</Badge>
                    )}
                    {!isWoff && !record?.clockIn && (
                      <Badge className="bg-rose-950/40 text-rose-400 border-none">Absent</Badge>
                    )}
                  </div>

                  <div className="space-y-3 font-mono">
                    <div className="flex justify-between text-xs py-1.5 border-b border-border/10">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Timer className="h-4 w-4 text-primary" /> Effective Hours</span>
                      <span className="font-bold text-foreground">{formatMsToHms(workingMs)}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 border-b border-border/10">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Coffee className="h-4 w-4 text-amber-500" /> Break Duration</span>
                      <span className="font-bold text-foreground">{formatMsToHms(breakMs)}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 border-b border-border/10">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-4 w-4 text-emerald-500" /> Gross Hours</span>
                      <span className="font-bold text-foreground">{formatMsToHms(grossMs)}</span>
                    </div>
                  </div>

                  {workingMs > 0 && renderMiniTimeline(workingMs, breakMs, grossMs)}
                </div>

                <div className="text-xs text-muted-foreground leading-relaxed p-1">
                  💡 Clicking on any date cell inside the **Month View** or **Week View** brings you directly to this Day timeline report.
                </div>
              </div>

              {/* Exact Timeline block */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-semibold">Timeline & Stopwatch Breakdown</h3>

                {events.length === 0 ? (
                  <div className="text-center py-16 bg-muted/5 border border-dashed border-border/30 rounded-xl text-muted-foreground text-xs">
                    {isWoff ? 'Weekly-off day. No attendance logs registered.' : 'No activity logged on this weekday.'}
                  </div>
                ) : (
                  <div className="border border-border/20 bg-zinc-950 rounded-xl p-6 space-y-4 shadow-sm">
                    {events.map((ev, i) => {
                      const startMs = new Date(ev.start).getTime();
                      const endMs = ev.end ? new Date(ev.end).getTime() : now;
                      const segmentDuration = endMs - startMs;
                      
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const totalSec = Math.floor(segmentDuration / 1000);
                      const hrs = Math.floor(totalSec / 3600);
                      const mins = Math.floor((totalSec % 3600) / 60);
                      const secs = totalSec % 60;
                      const durationStr = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;

                      return (
                        <div key={i} className={`flex items-center justify-between gap-1 text-[11px] font-semibold p-2.5 rounded-lg border ${
                          ev.type === 'break' 
                            ? 'text-amber-500/90 bg-amber-500/5 border-amber-500/10' 
                            : 'text-slate-200 bg-primary/5 border-primary/10'
                        }`}>
                          {/* Start Time */}
                          <div className="flex items-center gap-1.5 w-[120px] shrink-0">
                            {ev.type === 'break' ? (
                              <Coffee className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="tabular-nums whitespace-nowrap">{formatTime(ev.start)}</span>
                          </div>

                          {/* Divider */}
                          <span className="text-zinc-700 shrink-0">-</span>

                          {/* Stopwatch duration */}
                          <span className="font-mono text-[10px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300 tabular-nums shrink-0">
                            {durationStr}
                          </span>

                          {/* Divider */}
                          <span className="text-zinc-700 shrink-0">-</span>

                          {/* End Time */}
                          <div className="flex items-center gap-1.5 w-[120px] justify-end shrink-0">
                            <span className="tabular-nums whitespace-nowrap">{ev.end ? formatTime(ev.end) : 'IN PROGRESS'}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </Card>
  );
}
