"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../database/db";

export default function SeedPage() {
  const router = useRouter();
  const [log, setLog] = useState<string[]>(["Starting seed…"]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  useEffect(() => {
    async function seed() {
      try {
        const TODAY = "2026-05-21";
        const CLOCK_IN_ISO = new Date("2026-05-21T10:46:34+05:30").toISOString();
        // Exact break used from HR portal: 01:46:31 = 6391 seconds
        const TOTAL_BREAK_MS = 6391 * 1000;

        // 1. Clear existing data for today
        addLog("Clearing any existing data for today…");
        const existing = await db.attendance.where("date").equals(TODAY).first();
        if (existing?.id) {
          await db.tasks.where("attendanceId").equals(existing.id).delete();
          await db.attendance.delete(existing.id);
          addLog("  → Cleared.");
        }

        // 2. Create attendance record
        addLog("Creating attendance record (clocked-in: 10:46:34 AM)…");
        const attendanceId = (await db.attendance.add({
          date: TODAY,
          clockIn: CLOCK_IN_ISO,
          totalHours: 0,
          breakUsed: Math.floor(TOTAL_BREAK_MS / 60000),
          overtime: 0,
          attendanceStatus: "Present",
        })) as number;
        addLog(`  → Created. ID = ${attendanceId}`);

        // 3. Add 5 completed task sessions
        const sessions = [
          { start: "2026-05-21T10:46:34+05:30", end: "2026-05-21T11:13:08+05:30", sec: 1594 },
          { start: "2026-05-21T11:31:14+05:30", end: "2026-05-21T12:24:05+05:30", sec: 3171 },
          { start: "2026-05-21T12:27:06+05:30", end: "2026-05-21T13:29:00+05:30", sec: 3714 },
          { start: "2026-05-21T13:41:54+05:30", end: "2026-05-21T13:42:59+05:30", sec: 65 },
          { start: "2026-05-21T13:55:52+05:30", end: "2026-05-21T14:36:13+05:30", sec: 2421 },
        ];

        addLog("Adding 5 completed task sessions…");
        for (const s of sessions) {
          await db.tasks.add({
            attendanceId,
            project: "My Family",
            description: "Development",
            startTime: new Date(s.start).toISOString(),
            endTime:   new Date(s.end).toISOString(),
            totalHours: +(s.sec / 3600).toFixed(4),
            status: "Completed",
          });
        }
        addLog(`  → ${sessions.length} tasks saved.`);

        // 4. Write attendance state to localStorage
        addLog("Writing attendance state to localStorage…");
        const attendanceState = {
          attendanceId,
          clockInTime: CLOCK_IN_ISO,
          isClocked: true,
          onBreak: false,
          breakStartTime: null,
          totalBreakMs: TOTAL_BREAK_MS,
        };
        localStorage.setItem("tms_attendance_state", JSON.stringify(attendanceState));
        addLog("  → Done.");

        // 5. Write currently-running task timer to localStorage
        addLog("Writing active task timer to localStorage (started 3:35:50 PM)…");
        const timerState = {
          isRunning: true,
          startTime: new Date("2026-05-21T15:35:50+05:30").toISOString(),
          project: "My Family",
          description: "Development",
          status: "In Progress",
          pausedAt: null,
          totalPausedDuration: 0,
        };
        localStorage.setItem("tms_timer_state", JSON.stringify(timerState));
        addLog("  → Done.");

        addLog("✅ Seed complete! Redirecting to dashboard…");
        setDone(true);
        setTimeout(() => router.push("/"), 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        addLog(`❌ Error: ${msg}`);
      }
    }

    seed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-lg w-full rounded-2xl border border-border/50 bg-card shadow-xl p-6 space-y-4">
        <h1 className="text-lg font-bold">
          {error ? "❌ Seed Failed" : done ? "✅ Seed Complete" : "⏳ Seeding Data…"}
        </h1>
        <div className="bg-muted rounded-xl p-4 space-y-1 font-mono text-xs text-muted-foreground max-h-72 overflow-y-auto">
          {log.map((line, i) => (
            <p key={i} className={line.startsWith("✅") ? "text-emerald-500 font-semibold" : line.startsWith("❌") ? "text-red-500 font-semibold" : ""}>
              {line}
            </p>
          ))}
        </div>
        {error && (
          <p className="text-sm text-red-500">
            Check the browser console for more details (F12 → Console).
          </p>
        )}
        {done && !error && (
          <p className="text-sm text-emerald-500">Redirecting to dashboard in 2 seconds…</p>
        )}
      </div>
    </div>
  );
}
