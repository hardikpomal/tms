"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { format, parseISO, isWeekend, subMonths } from 'date-fns';
import { Coffee, CheckCircle2, Clock, AlertCircle, ArrowDownLeft, ArrowUpRight, Timer } from 'lucide-react';
import { AttendanceRecord } from '../../types';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '../ui/dropdown-menu';
import { formatTime } from '../../utils/time';

interface AttendanceLogTableProps {
  records: AttendanceRecord[];
}

export function AttendanceLogTable({ records }: AttendanceLogTableProps) {
  const [activeTab, setActiveTab] = useState('30 DAYS');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Check if there is an active clocked-in session
    const hasActiveSession = records.some(r => r.clockIn && !r.clockOut);
    if (!hasActiveSession) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [records]);
  
  // Generate the last 6 months dynamically for the tabs
  const tabs = ['30 DAYS'];
  for (let i = 0; i < 6; i++) {
    tabs.push(format(subMonths(new Date(), i), 'MMM').toUpperCase());
  }

  // Generate a realistic visual bar based on hours worked relative to a standard 9-hour day (gross)
  const renderVisual = (record: AttendanceRecord) => {
    let workingMs = 0;
    let breakMs = 0;
    let grossMs = 0;

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

    if (grossMs === 0) return <div className="h-2.5 w-32 bg-muted/30 rounded-full" />;
    
    // Max width represents 9 hours (gross). 
    // 9 hours in ms = 9 * 3600 * 1000 = 32,400,000 ms
    const fillPct = Math.min(100, (grossMs / 32400000) * 100);

    // If we have detailed break history (Schema v3+)
    if (record.breaks && record.breaks.length > 0) {
      const clockInMs = new Date(record.clockIn).getTime();
      const endMs = record.clockOut ? new Date(record.clockOut).getTime() : now;
      const totalTimelineMs = endMs - clockInMs;
      
      const segments: React.ReactNode[] = [];
      let currentMs = clockInMs;

      record.breaks.forEach((b, i) => {
        const breakStartMs = new Date(b.start).getTime();
        const breakEndMs = b.end ? new Date(b.end).getTime() : now;
        
        // Work segment before this break
        const workDuration = Math.max(0, breakStartMs - currentMs);
        if (workDuration > 0) {
          segments.push(<div key={`w-${i}`} className="h-full bg-primary" style={{ width: `${(workDuration / totalTimelineMs) * 100}%` }} />);
        }

        // Break segment
        const breakDuration = Math.max(0, breakEndMs - breakStartMs);
        if (breakDuration > 0) {
          segments.push(<div key={`b-${i}`} className="h-full bg-amber-500/80" style={{ width: `${(breakDuration / totalTimelineMs) * 100}%` }} />);
        }

        currentMs = breakEndMs;
      });

      // Final work segment after the last break
      const finalWorkDuration = Math.max(0, endMs - currentMs);
      if (finalWorkDuration > 0) {
        segments.push(<div key="w-final" className="h-full bg-primary" style={{ width: `${(finalWorkDuration / totalTimelineMs) * 100}%` }} />);
      }

      return (
        <div className="h-2.5 w-80 bg-muted/30 rounded-full flex overflow-hidden">
          <div className="flex h-full w-full" style={{ width: `${fillPct}%` }}>
            {segments}
          </div>
        </div>
      );
    }

    // Fallback for older records without detailed break history
    const breakPct = (breakMs / grossMs) * 100;
    const workPct = 100 - breakPct;
    
    return (
      <div className="h-2.5 w-80 bg-muted/30 rounded-full flex overflow-hidden">
        <div className="flex h-full w-full" style={{ width: `${fillPct}%` }}>
          <div className="h-full bg-primary" style={{ width: `${workPct}%` }} />
          {breakPct > 0 && <div className="h-full bg-amber-500/80" style={{ width: `${breakPct}%` }} /> }
        </div>
      </div>
    );
  };

  const renderLogDropdown = (record: AttendanceRecord) => {
    const events: { type: 'work' | 'break', start: string, end?: string }[] = [];
    
    if (record.breaks && record.breaks.length > 0) {
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
    } else if (record.clockIn) {
      events.push({ type: 'work', start: record.clockIn, end: record.clockOut });
    }

    if (events.length === 0) {
      return (
        <div className="flex justify-center">
          {renderIcon(record.attendanceStatus)}
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="cursor-pointer hover:bg-muted/50 p-2 rounded-full transition-colors inline-flex justify-center items-center border-none bg-transparent outline-none">
              {renderIcon(record.attendanceStatus)}
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-[390px] bg-zinc-950 border-zinc-800 text-slate-200 p-4 shadow-xl rounded-lg">
          <div className="space-y-3">
            {events.map((ev, i) => {
              const startMs = new Date(ev.start).getTime();
              const endMs = ev.end ? new Date(ev.end).getTime() : now;
              const durationStr = formatDuration(endMs - startMs);

              return (
                <div key={i} className={`flex items-center justify-between gap-1 text-[11px] font-semibold ${ev.type === 'break' ? 'text-amber-500/90' : 'text-slate-200'}`}>
                  {/* Start side */}
                  <div className="flex items-center gap-1.5 w-[100px] shrink-0">
                    {ev.type === 'break' ? <Coffee className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                    <span className="tabular-nums whitespace-nowrap">{formatTime(ev.start)}</span>
                  </div>

                  {/* Divider */}
                  <span className="text-zinc-700 shrink-0">-</span>

                  {/* Duration */}
                  <span className="font-mono text-[10px] bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/40 text-zinc-300 tabular-nums shrink-0">
                    {durationStr}
                  </span>

                  {/* Divider */}
                  <span className="text-zinc-700 shrink-0">-</span>

                  {/* End side */}
                  <div className="flex items-center gap-1.5 w-[100px] justify-end shrink-0">
                    <span className="tabular-nums whitespace-nowrap">{ev.end ? formatTime(ev.end) : 'MISSING'}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderIcon = (status: string) => {
    switch (status) {
      case 'Present': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'Late Login': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'Half Day': return <Coffee className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="bg-card border-border/50 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30 bg-muted/10 flex items-center justify-end overflow-x-auto w-full scrollbar-none">
        <div className="flex items-center gap-2 max-w-full">
          <div className="flex gap-1.5 text-xs font-medium shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-border/30 h-12">
              <TableHead className="text-[10px] uppercase tracking-wider h-10 w-[110px]">Date</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider h-10 w-80 hidden md:table-cell">Attendance Visual</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider h-10">Effective Hours</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider h-10">Break Taken</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider h-10">Gross Hours</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider h-10 text-center">Log</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No attendance records found for the last 30 days.
                </TableCell>
              </TableRow>
            )}

            {records.map((record) => {
              const dateObj = parseISO(record.date);
              const isWoff = isWeekend(dateObj);

              if (isWoff && record.totalHours === 0) {
                return (
                  <TableRow key={record.id} className="border-border/10 bg-muted/30 hover:bg-muted/40 h-16">
                    <TableCell className="font-medium text-[13px] py-5 w-[110px] whitespace-nowrap">
                      {format(dateObj, 'EEE, dd MMM')}
                      <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 h-4 bg-muted text-muted-foreground border-none rounded">W.OFF</Badge>
                    </TableCell>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-5">
                      Full day Weekly-off
                    </TableCell>
                  </TableRow>
                );
              }

              // Calculate precise millisecond durations for all columns
              let workingMs = 0;
              let breakMs = 0;
              let grossMs = 0;

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

              return (
                <TableRow key={record.id} className="border-border/10 hover:bg-muted/10 transition-colors h-16">
                  <TableCell className="font-medium text-[13px] py-5 whitespace-nowrap w-[110px]">
                    {format(dateObj, 'EEE, dd MMM')}
                  </TableCell>
                  <TableCell className="py-5 hidden md:table-cell">
                    {renderVisual(record)}
                  </TableCell>
                  <TableCell className="text-[13px] font-semibold py-5">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-primary/60" />
                      {formatMsToHms(workingMs)}{workingMs > 28800000 ? ' +' : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] py-5">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-amber-500/80" />
                      {formatMsToHms(breakMs)}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] font-medium py-5">
                    {formatMsToHms(grossMs)}{grossMs > 32400000 ? ' +' : ''}
                  </TableCell>
                  <TableCell className="text-center py-5">
                    <div className="flex justify-center">
                      {renderLogDropdown(record)}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatMsToHms(ms: number): string {
  if (ms <= 0) return '0h 0m 0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}
