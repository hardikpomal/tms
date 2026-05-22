"use client";

import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { db } from '../database/db';

export function DataManagement() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

  const handleExport = async () => {
    try {
      const attendance = await db.attendance.toArray();
      const tasks = await db.tasks.toArray();
      const localState = localStorage.getItem('tms_attendance_state');
      const timerState = localStorage.getItem('tms_timer_state');
      
      const payload = { attendance, tasks, localState, timerState };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `tms-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatus({ type: 'success', message: 'Data exported successfully!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to export data.' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      
      if (!payload.attendance || !payload.tasks) {
        throw new Error("Invalid backup file format");
      }

      await db.transaction('rw', db.attendance, db.tasks, async () => {
        await db.attendance.clear();
        await db.tasks.clear();
        
        if (payload.attendance.length > 0) {
          await db.attendance.bulkAdd(payload.attendance);
        }
        if (payload.tasks.length > 0) {
          await db.tasks.bulkAdd(payload.tasks);
        }
      });
      
      if (payload.localState) {
        localStorage.setItem('tms_attendance_state', payload.localState);
      }
      if (payload.timerState) {
        localStorage.setItem('tms_timer_state', payload.timerState);
      }
      
      setStatus({ type: 'success', message: 'Data restored! Reloading...' });
      
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to import data. Invalid file.' });
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Data Backup & Restore</CardTitle>
        <CardDescription>
          Transfer your attendance and timesheet data between different ports or devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {status.type !== 'idle' && (
          <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {status.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border/50 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-3 bg-muted/20">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Export Data</h3>
              <p className="text-xs text-muted-foreground mt-1">Download all your logs and timer states to a JSON file.</p>
            </div>
            <Button onClick={handleExport} className="w-full mt-2">Export to File</Button>
          </div>

          <div className="border border-border/50 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-3 bg-muted/20">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Import Data</h3>
              <p className="text-xs text-muted-foreground mt-1">Restore your data from a previous backup file.</p>
            </div>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImport}
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full mt-2">Upload Backup</Button>
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
}
