"use client";

import { useEffect, useState } from "react";

const BUSINESS_TZ = "America/New_York";

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function isOpen(date: Date) {
  const et = new Date(date.toLocaleString("en-US", { timeZone: BUSINESS_TZ }));
  const day = et.getDay(); // 0 = Sunday
  const hour = et.getHours();

  if (day === 0 || day === 6) return false; // weekend
  return hour >= 9 && hour < 17; // 9 a.m. – 5 p.m. ET
}

export default function TimeContextBlock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTime = formatTime(now, localTz);
  const etTime = formatTime(now, BUSINESS_TZ);
  const open = isOpen(now);

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
      <div className="flex flex-col gap-1">
        <div className={open ? "text-green-400" : "text-slate-400"}>
          {open ? "OPEN NOW" : "CURRENTLY CLOSED"}
        </div>
        <div className="mt-2 grid grid-cols-[max-content_auto] gap-x-3 gap-y-1 items-center">
          <div className="flex items-center gap-2">
            <span>🕒</span>
            <span>Your Local Time</span>
          </div>
          <span className="tabular-nums">{localTime}</span>

          <div className="flex items-center gap-2">
            <span>🌎</span>
            <span>CrewRules™ Time (ET)</span>
          </div>
          <span className="tabular-nums">{etTime}</span>
        </div>
      </div>
    </div>
  );
}
