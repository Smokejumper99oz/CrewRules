"use client";

import type { LucideIcon } from "lucide-react";
import { Calendar, Cloud, FileText, LayoutGrid, Mail, Plane, Stethoscope, User } from "lucide-react";
import type { PilotSubView } from "./demo-ops-view-context";
import { useDemoOpsView } from "./demo-ops-view-context";
import { DemoOpsSignOutButton } from "./demo-ops-sign-out-button";

const PILOT_NAV: ReadonlyArray<{
  label: string;
  icon: LucideIcon;
  subView?: PilotSubView;
}> = [
  { label: "Dashboard", icon: LayoutGrid, subView: "dashboard" },
  { label: "Weather Brief", icon: Cloud },
  { label: "Schedule", icon: Calendar },
  { label: "Documents", icon: FileText, subView: "documents" },
  { label: "Medical & Certifications", icon: Stethoscope, subView: "medical-certifications" },
  { label: "Messages", icon: Mail, subView: "messages" },
  { label: "My Profile", icon: User, subView: "my-profile" },
];

export function DemoOpsPilotSidebar() {
  const { showAdminDashboard, pilotSubView, setPilotSubView } = useDemoOpsView();

  return (
    <aside className="relative z-30 flex h-full max-h-[100dvh] w-64 shrink-0 flex-col overflow-hidden border-r border-slate-600/50 bg-gradient-to-b from-slate-900 via-[#152536] to-[#0c1520] text-white shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-amber-300 ring-1 ring-white/15">
          <Plane className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-extrabold leading-tight tracking-tight text-white">
            Crew<span className="text-amber-300">Rules</span>
            <span className="align-super text-[10px] font-bold text-white">™</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Pilot portal
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Pilot demo navigation">
        <ul className="space-y-1">
          {PILOT_NAV.map(({ label, icon: Icon, subView }) => {
            const active = subView != null && pilotSubView === subView;
            const onClick = subView != null ? () => setPilotSubView(subView) : undefined;

            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={onClick}
                  className={
                    active
                      ? "flex w-full items-center gap-3 rounded-md bg-emerald-500/15 px-3 py-2.5 text-left text-sm font-semibold text-emerald-100 ring-1 ring-emerald-400/35"
                      : "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200/70">
          DEMO PREVIEW
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button
              type="button"
              onClick={showAdminDashboard}
              className="flex w-full items-center gap-3 rounded-md border border-amber-400/45 bg-amber-400/10 px-3 py-2.5 text-left text-sm font-semibold text-amber-200 transition hover:border-amber-400/65 hover:bg-amber-400/18 hover:text-amber-100"
            >
              <LayoutGrid className="h-4 w-4 shrink-0 text-amber-200 opacity-90" aria-hidden />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                <span>Flight Ops Preview</span>
                <span className="shrink-0 text-amber-200/85" aria-hidden>
                  →
                </span>
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="border-t border-white/10 px-4 pb-14 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/90">DEMO OPS</p>
        <p className="text-[11px] text-slate-400">James Wilson</p>
        <div className="mt-3">
          <DemoOpsSignOutButton />
        </div>
      </div>
    </aside>
  );
}
