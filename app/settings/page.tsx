"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { DataManagement } from '../../components/DataManagement';

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function SettingsPage() {
  return (
    <div className="bg-background transition-colors duration-300 min-h-screen">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        <motion.header {...fadeUp} className="flex flex-col gap-1 mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage your local app data and preferences.
          </p>
        </motion.header>

        <motion.section {...fadeUp} transition={{ delay: 0.1 }}>
          <DataManagement />
        </motion.section>

      </div>
    </div>
  );
}
