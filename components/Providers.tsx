"use client";

import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { AttendanceProvider } from '../contexts/AttendanceContext';
import { TimerProvider } from '../contexts/TimerContext';
import { Toaster } from './ui/sonner';
import { BreakCorrector } from './BreakCorrector';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {!mounted ? (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 bg-primary/40 rounded-full animate-bounce" />
            <span className="text-sm font-medium">Initializing Mission Control...</span>
          </div>
        </div>
      ) : (
        <AttendanceProvider>
          <TimerProvider>
            <BreakCorrector />
            {children}
          </TimerProvider>
        </AttendanceProvider>
      )}
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
