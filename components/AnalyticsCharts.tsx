"use client";

import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { formatDuration } from '../utils/rules';

const COLORS = ['#6366f1', '#f59e0b']; // Indigo for Work, Amber for Break

export function AnalyticsCharts() {
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const { calc } = useAttendanceContext();

  const dailyData = useMemo(() => {
    if (!tasks) return [];
    const now = new Date();
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
    const map: Record<string, number> = {};
    days.forEach((d) => { map[format(d, 'MMM dd')] = 0; });
    // Add completed tasks from Dexie
    tasks.forEach((t) => {
      const key = format(parseISO(t.startTime), 'MMM dd');
      if (map[key] !== undefined) map[key] += t.totalHours;
    });

    // Override today with live attendance working time if it's higher (includes active timers)
    const todayKey = format(now, 'MMM dd');
    if (map[todayKey] !== undefined && calc?.workingMs) {
      map[todayKey] = Math.max(map[todayKey], calc.workingMs / 3600000);
    }

    return Object.entries(map).map(([name, hours]) => ({ name, hours: +hours.toFixed(2) }));
  }, [tasks, calc]);

  const breakData = useMemo(() => {
    if (!calc) return [{ name: 'Work', value: 8.5 }, { name: 'Break', value: 0.75 }];
    const workH = +(calc.workingMs / 3600000).toFixed(2);
    const breakH = +(calc.breakUsedMs / 3600000).toFixed(2);
    return [
      { name: 'Work', value: workH || 0.01 },
      { name: 'Break', value: breakH || 0.01 },
    ];
  }, [calc]);

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    borderColor: 'var(--border)',
    borderRadius: '8px',
    border: '1px solid',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    color: 'var(--foreground)'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Weekly bar chart */}
      <Card className="md:col-span-2 bg-card border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">7-Day Work Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} dy={8} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} 
                  ticks={[0, 2, 4, 6, 8.5]}
                  domain={[0, 'auto']}
                  tickFormatter={(v) => v === 8.5 ? '08:30h' : `${v}h`} 
                />
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  wrapperStyle={{ zIndex: 100, outline: 'none' }}
                  itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px' }}
                  formatter={(v) => [formatDuration((Array.isArray(v) ? v[0] : (v as number ?? 0)) * 3600000), 'Hours']} 
                  cursor={false} 
                />
                <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Work vs Break pie */}
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Today: Work vs Break</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {breakData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={tooltipStyle} 
                  wrapperStyle={{ zIndex: 100, outline: 'none' }}
                  itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px' }}
                  formatter={(v, name) => [formatDuration((Array.isArray(v) ? v[0] : (v as number ?? 0)) * 3600000), name]} 
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
