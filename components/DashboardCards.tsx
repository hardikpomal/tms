"use client";

import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { useTimerContext } from '../contexts/TimerContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Clock, CalendarDays, Calendar, CheckCircle2, Timer, AlarmClock, Coffee } from 'lucide-react';
import {
  isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay, parseISO,
} from 'date-fns';
import { formatDuration, formatHoursMinutes } from '../utils/rules';

export function DashboardCards() {
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const { calc, state: attState } = useAttendanceContext();
  const { state: timerState, runningDuration } = useTimerContext();

  const metrics = useMemo(() => {
    if (!tasks) return { today: 0, week: 0, month: 0, completed: 0 };
    const now = new Date();
    const todayI = { start: startOfDay(now), end: endOfDay(now) };
    const weekI = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    const monthI = { start: startOfMonth(now), end: endOfMonth(now) };
    let today = 0, week = 0, month = 0, completed = 0;
    tasks.forEach((t) => {
      const d = parseISO(t.startTime);
      if (isWithinInterval(d, todayI)) today += t.totalHours;
      if (isWithinInterval(d, weekI)) week += t.totalHours;
      if (isWithinInterval(d, monthI)) month += t.totalHours;
      if (t.status === 'Completed') completed++;
    });
    return { today, week, month, completed };
  }, [tasks]);

  const cards = [
    {
      title: "Today's Task Hours",
      value: `${metrics.today.toFixed(2)}h`,
      sub: attState.isClocked ? (
        <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Active: {timerState.project || 'No task running'}
        </span>
      ) : 'No active session',
      icon: Clock,
      accent: 'text-emerald-500',
    },
    {
      title: 'Weekly Hours',
      value: `${metrics.week.toFixed(2)}h`,
      sub: 'Total this week',
      icon: Calendar,
      accent: 'text-blue-500',
    },
    {
      title: 'Monthly Hours',
      value: `${metrics.month.toFixed(2)}h`,
      sub: 'Total this month',
      icon: CalendarDays,
      accent: 'text-violet-500',
    },
    {
      title: 'Work Remaining',
      value: calc ? formatDuration(calc.remainingMs) : '08:30:00',
      sub: 'Until full day',
      icon: AlarmClock,
      accent: calc?.remainingMs === 0 ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      title: 'Break Remaining',
      value: calc ? formatDuration(calc.breakRemainingMs) : '00:45:00',
      sub: 'Of 45m allowance',
      icon: Coffee,
      accent: calc?.breakRemainingMs === 0 ? 'text-red-500' : 'text-orange-500',
    },
    {
      title: 'Tasks Completed',
      value: String(metrics.completed),
      sub: 'All time',
      icon: CheckCircle2,
      accent: 'text-teal-500',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ title, value, sub, icon: Icon, accent }) => (
        <Card key={title} className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground leading-snug">{title}</CardTitle>
            <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold tabular-nums ${accent}`}>{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
