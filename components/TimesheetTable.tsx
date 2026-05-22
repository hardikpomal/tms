"use client";

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { TaskRecord, TaskStatus } from '../types';
import { useTimerContext } from '../contexts/TimerContext';
import { msToHours, formatDuration } from '../utils/rules';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { format, parseISO } from 'date-fns';
import { Search, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, Clock } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Completed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  'In Progress': 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  'On Hold': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
};

const PAGE_SIZE = 8;
const EMPTY_TASKS: TaskRecord[] = [];

export function TimesheetTable() {
  const dbTasks = useLiveQuery(() => db.tasks.orderBy('startTime').reverse().toArray()) ?? EMPTY_TASKS;
  const { state: timerState, runningDuration } = useTimerContext();

  const tasks = React.useMemo(() => {
    if (!timerState.startTime) return dbTasks;
    
    const liveTask: TaskRecord = {
      id: -1, // fake ID for the live active task
      attendanceId: -1,
      project: timerState.project || 'New Task...',
      description: timerState.description,
      startTime: timerState.startTime,
      endTime: '',
      totalHours: msToHours(runningDuration),
      status: timerState.status,
    };
    return [liveTask, ...dbTasks];
  }, [dbTasks, timerState, runningDuration]);

  const todayProjectSummary = React.useMemo(() => {
    const summary: Record<string, number> = {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Sum from persisted tasks that were started today
    dbTasks.forEach((t) => {
      const start = new Date(t.startTime);
      if (start.getTime() >= todayStart.getTime()) {
        summary[t.project] = (summary[t.project] || 0) + (t.totalHours * 3600000);
      }
    });

    // Add active running timer if started today
    if (timerState.startTime && runningDuration > 0) {
      const start = new Date(timerState.startTime);
      if (start.getTime() >= todayStart.getTime()) {
        const project = timerState.project || 'Active Session';
        summary[project] = (summary[project] || 0) + runningDuration;
      }
    }

    return Object.entries(summary).map(([name, ms]) => ({
      name,
      ms,
    })).sort((a, b) => b.ms - a.ms);
  }, [dbTasks, timerState, runningDuration]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>('all');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof TaskRecord>('startTime');
  const [sortAsc, setSortAsc] = useState(false);
  const [editRow, setEditRow] = useState<TaskRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<TaskRecord>>({});

  const filtered = tasks
    .filter((t) => {
      const q = search.toLowerCase();
      return (
        (t.project.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) &&
        (filterStatus === 'all' || filterStatus === null || t.status === filterStatus)
      );
    })
    .sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: keyof TaskRecord) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleDelete = async (id?: number) => {
    if (!id || !confirm('Delete this timesheet entry?')) return;
    await db.tasks.delete(id);
    toast.success('Entry deleted');
  };

  const openEdit = (row: TaskRecord) => {
    setEditRow(row);
    setEditForm({ project: row.project, description: row.description, status: row.status });
  };

  const saveEdit = async () => {
    if (!editRow?.id) return;
    await db.tasks.update(editRow.id, editForm);
    toast.success('Entry updated');
    setEditRow(null);
  };



  return (
    <div className="space-y-6">
      {/* Today's Projects Breakdown Widget */}
      {todayProjectSummary.length > 0 && (
        <Card className="bg-card border-border/50 shadow-sm p-4 overflow-hidden">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>Today&apos;s Time Allocation</span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                Total Today: {formatDuration(todayProjectSummary.reduce((acc, curr) => acc + curr.ms, 0))}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {todayProjectSummary.map((project) => {
                const totalTodayMs = todayProjectSummary.reduce((acc, curr) => acc + curr.ms, 0);
                const pct = totalTodayMs > 0 ? (project.ms / totalTodayMs) * 100 : 0;
                
                return (
                  <div key={project.name} className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/30 hover:border-primary/20 transition-all hover:bg-muted/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate max-w-[130px]" title={project.name}>
                        {project.name}
                      </span>
                      <span className="font-mono text-muted-foreground tabular-nums font-semibold">
                        {formatDuration(project.ms)}
                      </span>
                    </div>
                    {/* Tiny visual progress bar */}
                    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground text-right">{pct.toFixed(0)}% of today&apos;s work</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Timesheet Entries</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-9 w-48 bg-card border-border/50 text-sm"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-36 bg-card border-border/50 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('startTime')}>
                <span className="flex items-center gap-1 text-xs font-semibold">Date <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('project')}>
                <span className="flex items-center gap-1 text-xs font-semibold">Project / Task <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" /></span>
              </TableHead>
              <TableHead className="text-xs font-semibold">Description</TableHead>
              <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('startTime')}>
                <span className="flex items-center gap-1 text-xs font-semibold">Start <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" /></span>
              </TableHead>
              <TableHead className="text-xs font-semibold">End</TableHead>
              <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('totalHours')}>
                <span className="flex items-center gap-1 text-xs font-semibold">Hours <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('status')}>
                <span className="flex items-center gap-1 text-xs font-semibold">Status <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" /></span>
              </TableHead>
              <TableHead className="w-20 text-xs font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Search className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No entries found</p>
                    {search && <p className="text-xs">Try adjusting your search or filter</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : paginated.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/20 transition-colors group">
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(parseISO(row.startTime), 'MMM d')}
                </TableCell>
                <TableCell className="font-medium text-sm">{row.project}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{row.description}</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {format(parseISO(row.startTime), 'hh:mm:ss a')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {row.endTime ? format(parseISO(row.endTime), 'hh:mm:ss a') : 'In Progress...'}
                </TableCell>
                <TableCell className="text-sm font-semibold tabular-nums">
                  {formatDuration(row.totalHours * 3600000)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs border ${STATUS_COLORS[row.status]}`}
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.id !== -1 && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtered.length} entries</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-7 w-7 rounded-lg"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-3 py-1 text-xs">Page {page} of {totalPages}</span>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7 rounded-lg"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Project / Task"
              value={editForm.project ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, project: e.target.value }))}
            />
            <Input
              placeholder="Description"
              value={editForm.description ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Select
              value={editForm.status}
              onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as TaskStatus }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
