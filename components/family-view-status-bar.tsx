"use client";

import { Signal, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * iPhone-style status bar for the Family View desktop mockup.
 * Shows time (updates every minute) and connectivity icons.
 */
export function FamilyViewStatusBar() {
  const [time, setTime] = useState("9:41");

  useEffect(() => {
    const formatTime = () => {
      const now = new Date();
      return now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };
    setTime(formatTime());
    const id = setInterval(() => setTime(formatTime()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between px-6 py-2 text-xl font-semibold text-[#2F2F2F]">
      <span>{time}</span>
      <div className="flex items-center gap-2 text-[#2F2F2F]">
        <Signal className="size-5" strokeWidth={2.5} aria-hidden />
        <Wifi className="size-5" strokeWidth={2.5} aria-hidden />
        {/* Battery icon */}
        <div className="relative ml-1 h-5 w-7 overflow-hidden rounded-[3px] border-2 border-[#2F2F2F]">
          <div
            className="absolute bottom-0.5 left-0.5 top-0.5 w-[72%] rounded-[2px] bg-[#2F2F2F]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
