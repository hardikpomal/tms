"use client";

import { format } from 'date-fns';
import { motion } from 'framer-motion';

import { useAttendanceContext } from '../contexts/AttendanceContext';
import { TodayStatusCard } from '../components/TodayStatusCard';
import { TimerWidget } from '../components/TimerWidget';
import { DashboardCards } from '../components/DashboardCards';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { InjectMissingData } from '../components/InjectData';

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  const { state: attState } = useAttendanceContext();

  return (
    <div className="bg-background transition-colors duration-300 min-h-screen">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        <motion.header {...fadeUp} className="flex flex-col gap-1 mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
          <p className="text-xs text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </motion.header>
        
        <InjectMissingData />

        {/* ── Today Status Card ───────────────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.05 }}>
          <TodayStatusCard />
        </motion.section>

        {/* ── Task Timer (only when clocked in) ──────────────────────────── */}
        {attState.isClocked && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold">Task Timer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Active Session
              </span>
            </div>
            <TimerWidget attendanceId={attState.attendanceId} />
          </motion.section>
        )}

        {/* ── Dashboard Cards ─────────────────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.1 }}>
          <DashboardCards />
        </motion.section>

        {/* ── Analytics ───────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.15 }} className="pb-12">
          <AnalyticsCharts />
        </motion.section>

      </div>
    </div>
  );
}
