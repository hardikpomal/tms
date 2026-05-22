"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Edit2 } from 'lucide-react';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { toast } from 'sonner';

export function EditAttendanceDialog() {
  const { state } = useAttendanceContext();
  const [open, setOpen] = useState(false);
  const [clockInStr, setClockInStr] = useState('');
  const [breakUsedStr, setBreakUsedStr] = useState('');

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && state.clockInTime) {
      const d = new Date(state.clockInTime);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      setClockInStr(`${hh}:${mm}:${ss}`);

      const totalSec = Math.floor((state.totalBreakMs || 0) / 1000);
      const bhh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
      const bmm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const bss = String(totalSec % 60).padStart(2, '0');
      setBreakUsedStr(`${bhh}:${bmm}:${bss}`);
    }
  };

  const handleSave = () => {
    if (!state.clockInTime) return;

    try {
      // Parse Clock In
      const [ch, cm, cs] = clockInStr.split(':').map(Number);
      if (isNaN(ch) || isNaN(cm) || isNaN(cs)) throw new Error("Invalid clock in format");
      const newClockIn = new Date(state.clockInTime);
      newClockIn.setHours(ch, cm, cs, 0);

      // Parse Break
      const [bh, bm, bs] = breakUsedStr.split(':').map(Number);
      if (isNaN(bh) || isNaN(bm) || isNaN(bs)) throw new Error("Invalid break format");
      const newBreakMs = (bh * 3600 + bm * 60 + bs) * 1000;

      // Update Local Storage directly and refresh
      const raw = localStorage.getItem('tms_attendance_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.clockInTime = newClockIn.toISOString();
        parsed.totalBreakMs = newBreakMs;
        localStorage.setItem('tms_attendance_state', JSON.stringify(parsed));
        
        toast.success('Attendance times synced perfectly!');
        setOpen(false);
        // Force a page reload to resync state cleanly
        window.location.reload();
      }
    } catch {
      toast.error('Invalid format. Please use HH:MM:SS');
    }
  };

  if (!state.isClocked) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
        <Edit2 className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sync Official Times</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="clockIn" className="text-sm font-medium leading-none">Clock In Time (24h Format: HH:MM:SS)</label>
            <Input
              id="clockIn"
              value={clockInStr}
              onChange={(e) => setClockInStr(e.target.value)}
              placeholder="09:00:00"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="breakUsed" className="text-sm font-medium leading-none">Total Break Used (HH:MM:SS)</label>
            <Input
              id="breakUsed"
              value={breakUsedStr}
              onChange={(e) => setBreakUsedStr(e.target.value)}
              placeholder="01:30:00"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Sync Now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
