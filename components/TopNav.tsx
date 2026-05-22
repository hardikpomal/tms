"use client";

import { LogIn, LogOut, Coffee, Menu, ChevronRight, ChevronLeft } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { useTimerContext } from '../contexts/TimerContext';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { formatDuration, formatHoursMinutes } from '../utils/rules';
import { motion, AnimatePresence } from 'framer-motion';

export function TopNav({ 
  collapsed, 
  setCollapsed,
  isMobile,
  setMobileOpen
}: { 
  collapsed: boolean; 
  setCollapsed: (val: boolean) => void;
  isMobile: boolean;
  setMobileOpen: (val: boolean) => void;
}) {
  const { state, calc, clockIn, clockOut, startBreak, endBreak } = useAttendanceContext();
  const timer = useTimerContext();

  const handleClockIn = async () => {
    await clockIn();
    toast.success('Good morning! Clock-in recorded.', { description: new Date().toLocaleTimeString() });
  };

  const handleClockOut = async () => {
    if (!confirm('Are you sure you want to Clock Out for today?')) return;
    const result = await clockOut();
    if (result) {
      toast.success('Clocked out successfully!', {
        description: `You worked ${formatHoursMinutes(result.workingMs)} today.`,
      });
    }
  };

  const handleBreak = () => {
    if (state.onBreak) {
      endBreak();
      if (timer.state.startTime && !timer.state.isRunning && timer.state.pausedAt) {
        timer.resumeTimer();
        toast.info('Active task resumed. Back to work!');
      } else {
        toast.info('Break ended. Back to work!');
      }
    } else {
      if (timer.state.isRunning) {
        timer.pauseTimer();
        toast.info('Active task paused.');
      }
      startBreak();
      toast.info('Break started. Take a rest!');
    }
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl h-16 shrink-0 flex items-center justify-between px-3 sm:px-6 lg:px-8">
      
      {/* Left side: Collapse / Mobile Drawer toggle */}
      <div className="flex items-center gap-1.5">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => isMobile ? setMobileOpen(true) : setCollapsed(!collapsed)}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          {isMobile ? (
            <Menu className="h-5 w-5" />
          ) : collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
        {isMobile && (
          <span className="font-bold tracking-tight text-lg text-primary select-none pl-1">TMS</span>
        )}
      </div>

      {/* Right side: Global Controls */}
      <div className="h-full flex items-center gap-1.5 sm:gap-3">
        
        {/* Remaining Time / Clock Actions */}
        <AnimatePresence mode="popLayout">
          {!state.isClocked ? (
            <motion.div key="clock-in" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button
                onClick={handleClockIn}
                className="h-9 px-4 sm:px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5 sm:gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
              >
                <LogIn className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Clock In</span>
              </Button>
            </motion.div>
          ) : (
            <motion.div key="clock-out" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-1.5 sm:gap-3">
              
              {/* Break button */}
              <Button
                onClick={handleBreak}
                variant="outline"
                size={isMobile ? "icon" : "default"}
                className={`h-9 rounded-xl gap-2 transition-all hover:scale-105 shrink-0 ${
                  isMobile ? "w-9 p-0" : ""
                } ${
                  state.onBreak
                    ? 'border-amber-500/50 text-amber-600 bg-amber-500/10 dark:text-amber-400'
                    : ''
                }`}
                title={isMobile ? (state.onBreak ? 'End Break' : 'Take Break') : undefined}
              >
                <Coffee className="h-4 w-4" />
                {!isMobile && (state.onBreak ? 'End Break' : 'Take Break')}
              </Button>

              {/* Clock Out Button */}
              <Button
                onClick={handleClockOut}
                variant="outline"
                size={isMobile ? "icon" : "default"}
                className={`h-9 rounded-xl gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-all hover:scale-105 shrink-0 ${
                  isMobile ? "w-9 p-0" : ""
                }`}
                title={isMobile ? 'Clock Out' : undefined}
              >
                <LogOut className="h-4 w-4" />
                {!isMobile && 'Clock Out'}
              </Button>

              {/* Remaining Time Badge */}
              <div className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                <span className="text-[10px] font-semibold text-emerald-600/70 uppercase tracking-wider dark:text-emerald-400/70 hidden sm:inline">Remaining</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm tabular-nums">
                  {calc ? formatDuration(calc.remainingMs) : '00:00:00'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ThemeToggle />
      </div>
    </div>
  );
}
