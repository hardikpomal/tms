"use client";

import React, { useState } from 'react';
import { db } from '../database/db';
import { getTodayDateString } from '../utils/time';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function InjectMissingData() {
  const [loading, setLoading] = useState(false);

  const handleInject = async () => {
    try {
      setLoading(true);
      const today = getTodayDateString(); // e.g. "2026-05-25"
      const record = await db.attendance.where('date').equals(today).first();

      if (!record) {
        toast.error("No attendance record for today found. Please clock in first or create a record manually.");
        setLoading(false);
        return;
      }

      const attendanceId = record.id!;

      // 1. 10:53:48 AM - 12:26:36 PM: MenuSync
      // 2. 12:26:36 PM - 12:58:32 PM: Break
      // 3. 12:58:32 PM - 2:28:42 PM: My Family
      // 4. 2:28:42 PM - 2:40:03 PM: Break
      // 5. 2:40:03 PM - 2:40:48 PM: My Family
      // 6. 2:40:48 PM - 4:02:12 PM: Break
      // 7. 4:02:12 PM - MISSING: My Family

      const createDate = (timeStr: string) => {
        // timeStr format: "10:53:48 AM"
        const [time, ampm] = timeStr.split(' ');
        let [hours] = time.split(':').map(Number);
        const [, minutes, seconds] = time.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        const d = new Date();
        d.setHours(hours, minutes, seconds, 0);
        return d.toISOString();
      };

      const t1Start = createDate('10:53:48 AM');
      const t1End = createDate('12:26:36 PM');

      const b1Start = createDate('12:26:36 PM');
      const b1End = createDate('12:58:32 PM');

      const t2Start = createDate('12:58:32 PM');
      const t2End = createDate('02:28:42 PM');

      const b2Start = createDate('02:28:42 PM');
      const b2End = createDate('02:40:03 PM');

      const t3Start = createDate('02:40:03 PM');
      const t3End = createDate('02:40:48 PM');

      const b3Start = createDate('02:40:48 PM');
      const b3End = createDate('04:02:12 PM');

      const t4Start = createDate('04:02:12 PM');
      // end missing

      // Calculate total break minutes used
      const breaks = [
        { start: b1Start, end: b1End },
        { start: b2Start, end: b2End },
        { start: b3Start, end: b3End },
      ];
      
      let totalBreakMs = 0;
      for (const b of breaks) {
        totalBreakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
      
      const totalBreakMinutes = totalBreakMs / 60000;
      
      // OVERWRITE breaks
      await db.attendance.update(attendanceId, {
        breaks: breaks,
        breakUsed: totalBreakMinutes
      });

      // Clear existing tasks for this attendance record
      await db.tasks.where('attendanceId').equals(attendanceId).delete();

      // Insert tasks
      const getHours = (start: string, end: string) => {
        return (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
      };

      await db.tasks.bulkAdd([
        {
          attendanceId,
          project: 'MenuSync',
          description: 'Design Corrections: Live Chat Section (Master Admin)',
          startTime: t1Start,
          endTime: t1End,
          totalHours: getHours(t1Start, t1End),
          status: 'Completed',
          date: today
        },
        {
          attendanceId,
          project: 'My Family',
          description: 'Flow 8: Family Chat System',
          startTime: t2Start,
          endTime: t2End,
          totalHours: getHours(t2Start, t2End),
          status: 'Completed',
          date: today
        },
        {
          attendanceId,
          project: 'My Family',
          description: 'Flow 8: Family Chat System',
          startTime: t3Start,
          endTime: t3End,
          totalHours: getHours(t3Start, t3End),
          status: 'Completed',
          date: today
        },
        {
          attendanceId,
          project: 'My Family',
          description: 'Flow 8: Family Chat System',
          startTime: t4Start,
          totalHours: 0,
          status: 'In Progress', // MISSING end time
          date: today
        }
      ]);

      toast.success("Successfully injected missing data!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to inject data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleInject} disabled={loading} variant="outline" className="mb-4">
      {loading ? "Injecting..." : "Inject Missing Timeline Data"}
    </Button>
  );
}
