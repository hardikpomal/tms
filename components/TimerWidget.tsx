"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Pause, RotateCcw } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useTimerContext } from '../contexts/TimerContext';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { formatDuration } from '../utils/rules';
import { toast } from 'sonner';

interface TimerWidgetProps {
  attendanceId: number | null;
}

export function TimerWidget({ attendanceId }: TimerWidgetProps) {
  const { state, runningDuration, updateField, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimerContext();
  const { state: attendanceState, startBreak, endBreak } = useAttendanceContext();
  const isActive = state.isRunning || !!state.pausedAt;

  const handleStart = () => {
    if (!attendanceId) {
      toast.error('Please clock in first before tracking tasks.');
      return;
    }
    if (!state.project.trim()) {
      toast.error('Please enter a project or task name.');
      return;
    }
    startTimer(attendanceId);
    if (attendanceState.onBreak) endBreak();
    toast.success(`Tracking: ${state.project}`);
  };

  const handlePause = () => {
    pauseTimer();
    if (!attendanceState.onBreak) {
      startBreak();
      toast.info('Task paused. Auto-started your break!');
    }
  };

  const handleResume = () => {
    resumeTimer();
    if (attendanceState.onBreak) {
      endBreak();
      toast.info('Task resumed. Auto-ended your break!');
    }
  };

  const handleStop = async () => {
    if (!attendanceId) return;
    const record = await stopTimer(attendanceId);
    if (record) {
      toast.success(`Saved: ${record.project} — ${record.totalHours.toFixed(2)}h`);
    }
  };

  return (
    <Card className="border-border/50 bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Inputs */}
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
            <Input
              placeholder="What are you working on?"
              value={state.description}
              onChange={(e) => updateField('description', e.target.value)}
              disabled={isActive}
              className="flex-1 bg-muted/50 border-border/50 focus-visible:ring-primary/30 text-sm"
            />
            <Input
              placeholder="Project / Task *"
              value={state.project}
              onChange={(e) => updateField('project', e.target.value)}
              disabled={isActive}
              className="sm:w-44 bg-muted/50 border-border/50 focus-visible:ring-primary/30 text-sm"
            />
            <div className="flex items-center sm:w-36 px-3 bg-muted/50 border border-border/50 rounded-md text-sm text-muted-foreground">
              {state.status}
            </div>
          </div>

          {/* Timer display + controls */}
          <div className="flex items-center gap-4 lg:pl-4 lg:border-l border-border/40 shrink-0">
            <span className="font-mono text-2xl lg:text-3xl font-semibold tabular-nums tracking-tight text-foreground/90">
              {formatDuration(runningDuration)}
            </span>

            <AnimatePresence mode="popLayout">
              {!isActive ? (
                <motion.div key="start" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                  <Button
                    onClick={handleStart}
                    size="icon"
                    disabled={!attendanceId}
                    className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform hover:scale-110"
                  >
                    <Play className="h-5 w-5 ml-0.5" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="controls" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex gap-2">
                  {state.isRunning ? (
                    <Button onClick={handlePause} variant="outline" size="icon" className="h-11 w-11 rounded-full transition-transform hover:scale-110">
                      <Pause className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button onClick={handleResume} variant="outline" size="icon" className="h-11 w-11 rounded-full transition-transform hover:scale-110">
                      <RotateCcw className="h-5 w-5" />
                    </Button>
                  )}
                  <Button onClick={handleStop} variant="destructive" size="icon" className="h-11 w-11 rounded-full shadow-md transition-transform hover:scale-110">
                    <Square className="h-5 w-5 fill-current" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Active task indicator */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-border/40"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span>
                {state.isRunning ? 'Tracking' : 'Paused'}: <strong className="text-foreground">{state.project}</strong>
                {state.description && <span className="text-muted-foreground"> — {state.description}</span>}
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
