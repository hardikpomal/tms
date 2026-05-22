"use client";

import { motion } from 'framer-motion';
import { TimesheetTable } from '../../components/TimesheetTable';
import { ListTodo } from 'lucide-react';

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function TimesheetPage() {
  return (
    <div className="bg-background transition-colors duration-300">
      <div className="fixed inset-0 bg-linear-to-br from-primary/3 via-background to-violet-500/3 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        <motion.header {...fadeUp} className="flex flex-col gap-1 mb-2">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage and edit your historical task logs.
          </p>
        </motion.header>

        <motion.section {...fadeUp} transition={{ delay: 0.1 }} className="pb-12">
          <TimesheetTable />
        </motion.section>

      </div>
    </div>
  );
}
