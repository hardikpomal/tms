"use client";

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Search, FolderKanban, Clock, TrendingUp } from 'lucide-react';
import { formatDuration } from '../utils/rules';
import { useTimerContext } from '../contexts/TimerContext';

export function ProjectAnalytics() {
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const timer = useTimerContext();
  const [search, setSearch] = useState('');

  const projectStats = useMemo(() => {
    if (!tasks) return [];
    
    const stats: Record<string, { totalMs: number; completedCount: number; thisWeekMs: number; todayMs: number }> = {};
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    tasks.forEach(t => {
      if (!stats[t.project]) {
        stats[t.project] = { totalMs: 0, completedCount: 0, thisWeekMs: 0, todayMs: 0 };
      }
      
      const durationMs = t.totalHours * 3600000;
      stats[t.project].totalMs += durationMs;
      
      if (t.status === 'Completed') {
        stats[t.project].completedCount += 1;
      }

      if (new Date(t.startTime) > oneWeekAgo) {
        stats[t.project].thisWeekMs += durationMs;
      }

      if (new Date(t.startTime).getTime() >= todayStart.getTime()) {
        stats[t.project].todayMs += durationMs;
      }
    });

    // Add active timer time
    if (timer.state.project && timer.runningDuration > 0) {
      if (!stats[timer.state.project]) {
        stats[timer.state.project] = { totalMs: 0, completedCount: 0, thisWeekMs: 0, todayMs: 0 };
      }
      stats[timer.state.project].totalMs += timer.runningDuration;
      stats[timer.state.project].thisWeekMs += timer.runningDuration;
      stats[timer.state.project].todayMs += timer.runningDuration;
    }

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        ...data
      }))
      .sort((a, b) => b.totalMs - a.totalMs);
  }, [tasks, timer.state.project, timer.runningDuration]);

  const filteredProjects = projectStats.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (!tasks) return <div className="h-40 flex items-center justify-center">Loading analytics...</div>;

  const totalTimeAllProjects = projectStats.reduce((acc, curr) => acc + curr.totalMs, 0);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="grid grid-cols-2 gap-4 w-full sm:w-auto">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Projects</p>
                <p className="text-xl font-bold">{projectStats.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Logged</p>
                <p className="text-xl font-bold">{formatDuration(totalTimeAllProjects)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map(project => {
          const percentage = totalTimeAllProjects > 0 ? (project.totalMs / totalTimeAllProjects) * 100 : 0;
          
          return (
            <Card key={project.name} className="bg-card border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold truncate" title={project.name}>{project.name}</CardTitle>
                <CardDescription>
                  {project.completedCount} completed sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Time</span>
                    <span className="font-semibold">{formatDuration(project.totalMs)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary overflow-hidden rounded-full">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-right text-muted-foreground">
                    {percentage.toFixed(1)}% of all tracked time
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Today
                    </span>
                    <span className="font-medium">{formatDuration(project.todayMs)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      This Week
                    </span>
                    <span className="font-medium">{formatDuration(project.thisWeekMs)}</span>
                  </div>
                </div>

              </CardContent>
            </Card>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No projects found matching &#34;{search}&#34;
          </div>
        )}
      </div>

    </div>
  );
}
