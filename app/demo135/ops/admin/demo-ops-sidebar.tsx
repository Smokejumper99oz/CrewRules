"use client";

import {
  LayoutGrid,
  Calendar,
  User,
  UserCircle,
  Plane,
  Wrench,
  Clock,
  Bell,
  Inbox,
  FileText,
  Settings,
  ClipboardList,
} from "lucide-react";
import { DEMO_OPS_CREW_DUTY_NAV } from "./demo-ops-crew-duty-nav";
import { useDemoOpsView } from "./demo-ops-view-context";
import { DemoOpsSignOutButton } from "./demo-ops-sign-out-button";

const NAV_MAIN = [
  { label: "OPS Overview", icon: LayoutGrid, active: true },
  { label: "Schedule Management", icon: Calendar, active: false },
  { label: "Pilot Directory", icon: User, active: false },
  { label: "Fleet Overview", icon: Plane, active: false },
  { label: "Maintenance Control", icon: Wrench, active: false },
  { ...DEMO_OPS_CREW_DUTY_NAV, icon: Clock, active: false },
  { label: "Alerts & Notifications", icon: Bell, active: false },
] as const;

const NAV_TOOLS = [
  { label: "Upload Schedule", icon: Inbox },
  { label: "Reports & Exports", icon: FileText },
  { label: "Configuration", icon: Settings },
  { label: "Audit Log", icon: ClipboardList },
] as const;

export function DemoOpsSidebar() {
  const { showPilotProfilePreview } = useDemoOpsView();

  return (
    <aside className="relative z-30 flex h-full max-h-[100dvh] w-64 shrink-0 flex-col overflow-hidden border-r border-[#0a1f33] bg-[#102b46] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-amber-400/20 text-amber-300">
          <Plane className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-extrabold leading-tight tracking-tight text-white">
            Crew<span className="text-amber-300">Rules</span>
            <span className="align-super text-[10px] font-bold text-white">™</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
            Flight OPS Simplified
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Ops demo navigation">
        <ul className="space-y-0.5">
          {NAV_MAIN.map((item) => {
            const { label, icon: Icon, active } = item;
            const description = "description" in item ? item.description : undefined;

            const inactiveCls =
              "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white";
            const activeCls =
              "flex w-full items-center gap-3 rounded-sm bg-amber-400/15 px-3 py-2.5 text-left text-sm font-semibold text-amber-200 ring-1 ring-amber-400/35";

            const labelBlock = description ? (
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                <span>{label}</span>
                <span className="text-[11px] font-normal leading-snug text-white/55">{description}</span>
              </span>
            ) : (
              label
            );

            return (
              <li key={label}>
                <button type="button" className={active ? activeCls : inactiveCls}>
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  {labelBlock}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Operations tools
        </p>
        <ul className="mt-2 space-y-0.5">
          {NAV_TOOLS.map(({ label, icon: Icon }) => (
            <li key={label}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200/70">
          DEMO PREVIEW
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button
              type="button"
              onClick={showPilotProfilePreview}
              className="flex w-full items-center gap-3 rounded-sm border border-amber-400/45 bg-amber-400/10 px-3 py-2.5 text-left text-sm font-semibold text-amber-200 transition hover:border-amber-400/65 hover:bg-amber-400/18 hover:text-amber-100"
            >
              <UserCircle className="h-4 w-4 shrink-0 text-amber-200 opacity-90" aria-hidden />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                <span>Pilot Profile Preview</span>
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
        <p className="text-[11px] text-white/60">Sven Folmer</p>
        <div className="mt-3">
          <DemoOpsSignOutButton />
        </div>
      </div>
    </aside>
  );
}
