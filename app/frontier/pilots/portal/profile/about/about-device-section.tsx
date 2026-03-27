"use client";

import { useEffect, useState } from "react";

type DeviceInfo = {
  deviceType: string;
  os: string;
  browser: string;
  localTime: string;
  utc: string;
};

function parseUserAgent(): Pick<DeviceInfo, "deviceType" | "os" | "browser"> {
  if (typeof navigator === "undefined") {
    return { deviceType: "—", os: "—", browser: "—" };
  }
  const ua = navigator.userAgent;
  let deviceType = "Desktop";
  // iPad in desktop mode (iPadOS 13+) sends Mac-like UA; detect via touch support
  const isLikelyIPad = /Mac/.test(ua) && navigator.maxTouchPoints > 1;
  if (isLikelyIPad) {
    deviceType = "Tablet";
  } else if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
    deviceType = /iPad|Tablet/i.test(ua) ? "Tablet" : "Mobile";
  }
  let os = "Unknown";
  if (isLikelyIPad) os = "iPadOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  return { deviceType, os, browser };
}

export function AboutDeviceSection() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);

  useEffect(() => {
    const parsed = parseUserAgent();
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzDisplay = tz.replace(/_/g, " ");
    const utcTime = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    setInfo({
      ...parsed,
      localTime: `${timeStr} ${tzDisplay}`,
      utc: `${utcTime} UTC`,
    });
  }, []);

  if (!info) {
    return (
      <div className="py-3 text-sm text-slate-500">Loading device info…</div>
    );
  }

  return (
    <dl className="space-y-0 divide-y divide-slate-200 dark:divide-white/5">
      <div className="flex justify-between gap-4 py-3 first:pt-0">
        <dt className="text-sm text-slate-400 shrink-0">Device Type</dt>
        <dd className="text-sm text-slate-200 text-right">{info.deviceType}</dd>
      </div>
      <div className="flex justify-between gap-4 py-3">
        <dt className="text-sm text-slate-400 shrink-0">OS</dt>
        <dd className="text-sm text-slate-200 text-right">{info.os}</dd>
      </div>
      <div className="flex justify-between gap-4 py-3">
        <dt className="text-sm text-slate-400 shrink-0">Browser</dt>
        <dd className="text-sm text-slate-200 text-right">{info.browser}</dd>
      </div>
      <div className="flex justify-between gap-4 py-3">
        <dt className="text-sm text-slate-400 shrink-0">Local Time</dt>
        <dd className="text-sm text-slate-200 text-right">{info.localTime}</dd>
      </div>
      <div className="flex justify-between gap-4 py-3">
        <dt className="text-sm text-slate-400 shrink-0">UTC</dt>
        <dd className="text-sm text-slate-200 text-right">{info.utc}</dd>
      </div>
    </dl>
  );
}
