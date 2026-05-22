"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Sidebar for Desktop, overlay drawer for Mobile */}
      <Sidebar 
        collapsed={collapsed} 
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Mobile Sidebar backdrop */}
      {isMobile && mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopNav 
          collapsed={collapsed} 
          setCollapsed={setCollapsed} 
          isMobile={isMobile}
          setMobileOpen={setMobileOpen}
        />
        <main className="flex-1 overflow-y-auto w-full">{children}</main>
      </div>
    </div>
  );
}
