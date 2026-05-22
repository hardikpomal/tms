"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  ListTodo, 
  BarChart3, 
  Clock3,
  CalendarDays,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { useAttendanceContext } from '../contexts/AttendanceContext';
import { useTimerContext } from '../contexts/TimerContext';
import { toast } from 'sonner';

const NAV_LINKS = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Attendance', href: '/attendance', icon: CalendarDays },
  { name: 'Timesheet', href: '/timesheet', icon: ListTodo },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ 
  collapsed, 
  isMobile = false, 
  mobileOpen = false, 
  onClose 
}: { 
  collapsed: boolean; 
  isMobile?: boolean; 
  mobileOpen?: boolean; 
  onClose?: () => void; 
}) {
  const pathname = usePathname();

  return (
    <motion.div 
      animate={isMobile ? {
        x: mobileOpen ? 0 : -260,
        width: 260
      } : {
        x: 0,
        width: collapsed ? 80 : 260
      }}
      initial={isMobile ? { x: -260, width: 260 } : { x: 0, width: collapsed ? 80 : 260 }}
      transition={{ type: "spring", stiffness: 350, damping: 35 }}
      className={cn(
        "h-screen bg-background border-r border-border/50 flex flex-col shrink-0",
        isMobile ? "fixed left-0 top-0 bottom-0 z-50 shadow-2xl" : "relative z-20"
      )}
    >
      {/* Brand Header */}
      <div className={cn("h-16 flex items-center border-b border-border/50 shrink-0 relative", (collapsed && !isMobile) ? "justify-center" : "px-4")}>
        <Link href="/" className={cn("flex items-center gap-3", (collapsed && !isMobile) ? "hidden" : "")} onClick={() => isMobile && onClose?.()}>
          <div className="p-2 bg-primary/10 rounded-xl ring-1 ring-primary/20 shrink-0">
            <Clock3 className="h-6 w-6 text-primary" />
          </div>
          <span className="font-bold tracking-tight text-xl whitespace-nowrap overflow-hidden">TMS</span>
        </Link>
        
        {(collapsed && !isMobile) && (
          <Link href="/" className="h-12 w-12 rounded-xl flex items-center justify-center">
             <div className="p-2 bg-primary/10 rounded-xl ring-1 ring-primary/20 shrink-0">
               <Clock3 className="h-5 w-5 text-primary" />
             </div>
          </Link>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => isMobile && onClose?.()}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors group",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                (collapsed && !isMobile) ? "justify-center" : ""
              )}
              title={(collapsed && !isMobile) ? link.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {(!collapsed || isMobile) && <span className="whitespace-nowrap overflow-hidden">{link.name}</span>}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>

    </motion.div>
  );
}
