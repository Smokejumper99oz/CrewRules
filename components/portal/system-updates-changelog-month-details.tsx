"use client";

import { useState, type ReactNode } from "react";

const SUMMARY_CLASS =
  "cursor-pointer text-lg font-semibold tracking-tight text-white border-b border-white/10 pb-2";

type Props = {
  initialOpen: boolean;
  summaryLabel: string;
  children: ReactNode;
};

export function SystemUpdatesChangelogMonthDetails({ initialOpen, summaryLabel, children }: Props) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={SUMMARY_CLASS}>{summaryLabel}</summary>
      {children}
    </details>
  );
}
