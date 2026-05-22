"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Edit2, Plus, Trash2, Clock, Coffee } from 'lucide-react';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { db } from '../database/db';
import { toast } from 'sonner';
import { getTodayDateString } from '../utils/time';

interface LogSegment {
  id: string;
  type: 'work' | 'break';
  start: string; // HH:MM:SS
  end: string;   // HH:MM:SS
}

export function EditAttendanceDialog() {
  const { state } = useAttendanceContext();
  const [open, setOpen] = useState(false);
  const [segments, setSegments] = useState<LogSegment[]>([]);

  // Add Segment Form State
  const [newType, setNewType] = useState<'work' | 'break'>('break');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const dateToTimeStr = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const timeToDate = (timeStr: string, baseDate: Date): Date => {
    const [h, m, s] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, s, 0);
    return d;
  };

  const buildSegments = (clockIn: string, clockOut: string | null | undefined, breaksList: { start: string; end?: string }[]) => {
    const initialSegments: LogSegment[] = [];
    const endMs = clockOut ? new Date(clockOut).getTime() : Date.now();

    const sortedBreaks = [...(breaksList || [])]
      .filter(b => b.start)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    let currentMs = new Date(clockIn).getTime();
    let idCounter = 1;

    sortedBreaks.forEach(b => {
      const bStartMs = new Date(b.start).getTime();
      const bEndMs = b.end ? new Date(b.end).getTime() : endMs;

      // Add Work segment before this break
      if (bStartMs > currentMs) {
        initialSegments.push({
          id: `w-${idCounter++}`,
          type: 'work',
          start: dateToTimeStr(new Date(currentMs).toISOString()),
          end: dateToTimeStr(new Date(bStartMs).toISOString())
        });
      }

      // Add Break segment
      initialSegments.push({
        id: `b-${idCounter++}`,
        type: 'break',
        start: dateToTimeStr(b.start),
        end: dateToTimeStr(new Date(bEndMs).toISOString())
      });

      currentMs = bEndMs;
    });

    // Add Final work segment
    if (endMs > currentMs) {
      initialSegments.push({
        id: `w-${idCounter++}`,
        type: 'work',
        start: dateToTimeStr(new Date(currentMs).toISOString()),
        end: dateToTimeStr(new Date(endMs).toISOString())
      });
    }

    return initialSegments;
  };

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) return;

    setNewStart('');
    setNewEnd('');

    // Fetch today's record from DB
    const todayStr = getTodayDateString();
    const todayRecord = await db.attendance.where('date').equals(todayStr).first();

    if (todayRecord) {
      const initialSegments = buildSegments(
        todayRecord.clockIn,
        todayRecord.clockOut,
        todayRecord.breaks || []
      );
      setSegments(initialSegments);
    } else if (state.clockInTime) {
      const initialSegments = buildSegments(
        state.clockInTime,
        null,
        state.breakHistory || []
      );
      setSegments(initialSegments);
    } else {
      setSegments([]);
    }
  };

  const handleAddSegment = () => {
    if (!newStart || !newEnd) {
      toast.error('Please enter both start and end times');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(newStart) || !timeRegex.test(newEnd)) {
      toast.error('Invalid time format. Please use HH:MM:SS');
      return;
    }

    const [sh, sm, ss] = newStart.split(':').map(Number);
    const [eh, em, es] = newEnd.split(':').map(Number);
    const startVal = sh * 3600 + sm * 60 + ss;
    const endVal = eh * 3600 + em * 60 + es;

    if (startVal >= endVal) {
      toast.error('Start time must be before end time');
      return;
    }

    const newSeg: LogSegment = {
      id: String(Date.now() + Math.random()),
      type: newType,
      start: newStart,
      end: newEnd
    };

    setSegments(prev => [...prev, newSeg].sort((a, b) => {
      const [ah, am, as] = a.start.split(':').map(Number);
      const [bh, bm, bs] = b.start.split(':').map(Number);
      return (ah * 3600 + am * 60 + as) - (bh * 3600 + bm * 60 + bs);
    }));

    toast.success(`${newType === 'break' ? 'Break' : 'Work'} log segment added!`);
    setNewStart('');
    setNewEnd('');
  };

  const handleDeleteSegment = (id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id));
    toast.success('Log segment removed');
  };

  const handleSegmentChange = (id: string, field: 'type' | 'start' | 'end', value: string) => {
    setSegments(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    if (segments.length === 0) {
      toast.error("You must have at least one log segment");
      return;
    }

    try {
      const todayStr = getTodayDateString();
      const todayRecord = await db.attendance.where('date').equals(todayStr).first();

      const baseDate = todayRecord ? new Date(todayRecord.clockIn) : new Date();

      const parsedSegments = segments.map(seg => {
        const startDate = timeToDate(seg.start, baseDate);
        const endDate = timeToDate(seg.end, baseDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(`Invalid time format in segment: ${seg.start} - ${seg.end}`);
        }
        if (startDate.getTime() >= endDate.getTime()) {
          throw new Error(`Start time must be before end time in: ${seg.start} - ${seg.end}`);
        }

        return {
          type: seg.type,
          start: startDate,
          end: endDate
        };
      });

      // Sort chronologically
      parsedSegments.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Earliest start time is the new clockIn
      const newClockIn = parsedSegments[0].start;
      const newClockOut = parsedSegments[parsedSegments.length - 1].end;
      
      // Calculate break history and total break ms
      const newBreakHistory: { start: string; end?: string }[] = [];
      let newTotalBreakMs = 0;

      parsedSegments.forEach(seg => {
        if (seg.type === 'break') {
          newBreakHistory.push({
            start: seg.start.toISOString(),
            end: seg.end.toISOString()
          });
          newTotalBreakMs += (seg.end.getTime() - seg.start.getTime());
        }
      });

      // If they are currently active (clocked in) today, keep them clocked in
      const isCurrentlyClockedIn = !!(state.isClocked && state.attendanceId && !todayRecord?.clockOut);

      const endMsForWorkingCalc = isCurrentlyClockedIn ? Date.now() : newClockOut.getTime();
      const totalInTimeMs = Math.max(0, endMsForWorkingCalc - newClockIn.getTime());
      const workingMs = Math.max(0, totalInTimeMs - newTotalBreakMs);
      const overtimeMs = workingMs > 8.5 * 3600000 ? workingMs - 8.5 * 3600000 : 0;
      
      const deriveStatus = (wMs: number, cInIso: string) => {
        const clockIn = new Date(cInIso);
        const expectedStart = new Date(clockIn);
        expectedStart.setHours(9, 0, 0, 0); // 9:00 AM shift start
        const isLate = clockIn.getTime() - expectedStart.getTime() > 10 * 60 * 1000;

        if (wMs >= 8.5 * 3600000) return 'Full Day';
        if (wMs >= 4.25 * 3600000) return isLate ? 'Late Login' : 'Present';
        if (wMs > 0) return 'Half Day';
        return 'Absent';
      };

      const newStatus = deriveStatus(workingMs, newClockIn.toISOString());

      let finalAttendanceId = state.attendanceId;

      if (todayRecord) {
        finalAttendanceId = todayRecord.id!;
        await db.attendance.update(todayRecord.id!, {
          clockIn: newClockIn.toISOString(),
          clockOut: isCurrentlyClockedIn ? undefined : newClockOut.toISOString(),
          breakUsed: Math.floor(newTotalBreakMs / 60000),
          totalHours: workingMs / 3600000,
          overtime: overtimeMs / 3600000,
          attendanceStatus: newStatus,
          breaks: newBreakHistory
        });
      } else {
        const newId = await db.attendance.add({
          date: todayStr,
          clockIn: newClockIn.toISOString(),
          clockOut: newClockOut.toISOString(),
          breakUsed: Math.floor(newTotalBreakMs / 60000),
          totalHours: workingMs / 3600000,
          overtime: overtimeMs / 3600000,
          attendanceStatus: newStatus,
          breaks: newBreakHistory
        });
        finalAttendanceId = newId as number;
      }

      // Update Local Storage
      const updatedState = {
        attendanceId: finalAttendanceId,
        clockInTime: newClockIn.toISOString(),
        isClocked: isCurrentlyClockedIn,
        onBreak: false,
        breakStartTime: null,
        totalBreakMs: newTotalBreakMs,
        breakHistory: newBreakHistory
      };
      localStorage.setItem('tms_attendance_state', JSON.stringify(updatedState));

      toast.success('Attendance logs synchronized perfectly!');
      setOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Invalid times. Please use HH:MM:SS format');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
        <Edit2 className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Correct Today&apos;s Logs</DialogTitle>
        </DialogHeader>

        {/* Existing Logs List */}
        <div className="space-y-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            Today&apos;s Chronological Logs
          </span>
          
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {segments.map((seg) => (
              <div 
                key={seg.id} 
                className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/40 text-xs"
              >
                {/* Type Selector Toggle */}
                <select
                  value={seg.type}
                  onChange={(e) => handleSegmentChange(seg.id, 'type', e.target.value as 'work' | 'break')}
                  className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] font-semibold font-sans focus:outline-none"
                >
                  <option value="work">Work</option>
                  <option value="break">Break</option>
                </select>

                {/* Start input */}
                <Input
                  value={seg.start}
                  onChange={(e) => handleSegmentChange(seg.id, 'start', e.target.value)}
                  className="h-7 text-[11px] font-mono py-1 px-1.5 text-center bg-zinc-950 border-zinc-800 shrink-0 w-[84px]"
                  placeholder="HH:MM:SS"
                />

                <span className="text-muted-foreground text-[10px]">to</span>

                {/* End input */}
                <Input
                  value={seg.end}
                  onChange={(e) => handleSegmentChange(seg.id, 'end', e.target.value)}
                  className="h-7 text-[11px] font-mono py-1 px-1.5 text-center bg-zinc-950 border-zinc-800 shrink-0 w-[84px]"
                  placeholder="HH:MM:SS"
                />

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteSegment(seg.id)}
                  className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 ml-auto shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Add Missing Log Form */}
        <div className="border-t border-border/50 pt-4 mt-2 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Plus className="h-3.5 w-3.5 text-primary" /> Add Missing Log Segment
          </span>

          <div className="grid grid-cols-3 gap-2 bg-muted/15 p-3 rounded-xl border border-border/30">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'work' | 'break')}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-medium focus:outline-none h-8 w-full"
              >
                <option value="break">☕ Break</option>
                <option value="work">💼 Work</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Start (HH:MM:SS)</label>
              <Input
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                placeholder="13:00:00"
                className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 text-center"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">End (HH:MM:SS)</label>
              <Input
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                placeholder="13:20:00"
                className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 text-center"
              />
            </div>

            <Button 
              onClick={handleAddSegment} 
              size="sm" 
              className="col-span-3 mt-1 h-8 text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
            >
              Add Segment
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 border-t border-border/50 pt-4 mt-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="h-9 text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} className="h-9 text-xs font-medium">
            Save & Sync Logs
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

