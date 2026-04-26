import { AlertTriangle, Calendar, Flag, Info, Plane, Users } from "lucide-react";

const CARD = "overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl shadow-slate-900/10";
const CARD_HEAD = "bg-gradient-to-r from-[#102b46] to-[#173c5f] px-4 py-3";
const CARD_BODY = "p-4 sm:p-5";
const SECTION_TITLE = "font-serif text-xl font-bold text-[#17324d] md:text-2xl";
const LINK =
  "text-sm font-semibold text-[#102b46] underline decoration-[#102b46]/35 underline-offset-2 transition hover:text-amber-800 hover:decoration-amber-700/50";
const BTN_PRIMARY =
  "w-full rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-black/20 transition hover:brightness-110";

const OPS_SNAPSHOT = [
  {
    label: "Pilots Active Today",
    value: "132",
    sub: "of 145 total pilots",
    Icon: Users,
    iconWrap: "bg-amber-100 text-[#102b46]",
    spark: "text-amber-600",
    sparkPath: "M0 28 L12 18 L24 26 L36 14 L48 22 L60 16 L72 20",
  },
  {
    label: "Flights Scheduled",
    value: "284",
    sub: "for today",
    Icon: Calendar,
    iconWrap: "bg-[#e8f0f7] text-[#17324d]",
    spark: "text-[#102b46]",
    sparkPath: "M0 24 L14 32 L28 12 L42 22 L56 8 L70 18 L72 14",
  },
  {
    label: "Aircraft Available",
    value: "18 / 21",
    sub: "in service",
    Icon: Plane,
    iconWrap: "bg-[#f1f5f9] text-[#17324d]",
    spark: "text-[#17324d]",
    sparkPath: "M0 30 L16 22 L32 30 L48 10 L64 24 L72 12",
  },
  {
    label: "Alerts / Flags",
    value: "3",
    sub: "requires attention",
    valueClass: "text-red-600",
    Icon: Flag,
    iconWrap: "bg-red-100 text-red-600",
    spark: "text-red-500",
    sparkPath: "M0 26 L18 34 L36 16 L54 28 L72 8",
  },
] as const;

const SCHEDULE_ROWS = [
  { status: "Departing Today", flights: 126, pilots: 126, coverage: "100%", dot: "bg-emerald-500" },
  { status: "On Time", flights: 98, pilots: 98, coverage: "100%", dot: "bg-emerald-500" },
  { status: "Delayed", flights: 12, pilots: 12, coverage: "100%", dot: "bg-amber-400" },
  { status: "Cancelled", flights: 2, pilots: 0, coverage: "—", dot: "bg-red-500" },
] as const;

const OPS_BRIEF = [
  { title: "Pilot readiness", detail: "4 pilots need review" },
  { title: "Fleet", detail: "N305FR in maintenance" },
  { title: "Schedule", detail: "2 open trips" },
] as const;

const PILOT_ROWS = [
  {
    name: "James Wilson",
    line: "ATP · A320",
    status: "Ready",
    statusStyle: "bg-emerald-100 text-emerald-800",
    medical: "Class 1 · Exp. 05/15/2026",
    certs: "Current",
    training: "Current",
    flags: "—",
    flagTone: "",
  },
  {
    name: "Sarah Chen",
    line: "ATP · CL30",
    status: "Review",
    statusStyle: "bg-amber-100 text-amber-800",
    medical: "Class 1 · Exp. 02/01/2026",
    certs: "LOE due in 14 days",
    training: "Current",
    flags: "Training window",
    flagTone: "text-amber-700",
  },
  {
    name: "Marcus Reid",
    line: "ATP · B737",
    status: "Not Ready",
    statusStyle: "bg-red-100 text-red-800",
    medical: "Medical expired",
    certs: "IPC overdue",
    training: "Recurrent due",
    flags: "3 items",
    flagTone: "text-red-600",
  },
] as const;

const ALERT_ITEMS = [
  {
    title: "Fatigue Risk Alert",
    time: "18m ago",
    tone: "border-l-red-500 bg-red-50/80",
    icon: "flag",
  },
  {
    title: "Maintenance Alert",
    time: "1h ago",
    tone: "border-l-amber-500 bg-amber-50/60",
    icon: "warn",
  },
  {
    title: "Schedule Alert",
    time: "2h ago",
    tone: "border-l-[#102b46] bg-[#e8f0f7]/90",
    icon: "info",
  },
] as const;

function MiniSparkline({ pathD, className }: { pathD: string; className: string }) {
  return (
    <svg className={`h-10 w-[72px] shrink-0 ${className}`} viewBox="0 0 72 40" fill="none" aria-hidden>
      <path d={pathD} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FleetDonut() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              #22c55e 0deg ${(18 / 21) * 360}deg,
              #f97316 ${(18 / 21) * 360}deg ${(19 / 21) * 360}deg,
              #ef4444 ${(19 / 21) * 360}deg ${(20 / 21) * 360}deg,
              #94a3b8 ${(20 / 21) * 360}deg 360deg
            )`,
          }}
        />
        <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner shadow-slate-200/50">
          <p className="text-2xl font-bold text-[#17324d]">21</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">Total aircraft</p>
        </div>
      </div>
      <ul className="grid w-full gap-2 text-xs sm:grid-cols-2">
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          18 Available
        </li>
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          1 In maintenance
        </li>
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          1 Deferred
        </li>
        <li className="flex items-center gap-2 text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          1 Out of service
        </li>
      </ul>
      <button type="button" className={LINK}>
        View fleet overview →
      </button>
    </div>
  );
}

function AlertRowIcon({ kind }: { kind: string }) {
  if (kind === "flag") {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-red-100 text-red-600">
        <Flag className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  if (kind === "warn") {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-amber-100 text-amber-700">
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#e8f0f7] text-[#102b46]">
      <Info className="h-4 w-4" aria-hidden />
    </span>
  );
}

export default function Demo135OpsAdminPage() {
  return (
    <div className="space-y-8">
      <section aria-labelledby="ops-snapshot-heading">
        <h2 id="ops-snapshot-heading" className={SECTION_TITLE}>
          Ops Snapshot
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {OPS_SNAPSHOT.map((row) => (
            <li key={row.label} className={`${CARD} flex flex-col`}>
              <div className={CARD_HEAD}>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{row.label}</p>
              </div>
              <div className={`${CARD_BODY} flex flex-1 gap-3`}>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${row.iconWrap}`}
                >
                  <row.Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-2xl font-extrabold tracking-tight ${"valueClass" in row ? row.valueClass : "text-[#17324d]"}`}
                  >
                    {row.value}
                  </p>
                  <p className="mt-0.5 text-xs text-[#666666]">{row.sub}</p>
                </div>
                <MiniSparkline pathD={row.sparkPath} className={row.spark} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Schedule, fleet, and brief">
        <div className={`${CARD} xl:col-span-1`}>
          <div className={CARD_HEAD}>
            <h2 className="text-lg font-extrabold text-white">Today&apos;s Schedule Overview</h2>
          </div>
          <div className={CARD_BODY}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-[#17324d]">
                    <th className="pb-2 pr-2">Status</th>
                    <th className="pb-2 pr-2 text-right">Flights</th>
                    <th className="pb-2 pr-2 text-right">Pilots</th>
                    <th className="pb-2 text-right">Coverage</th>
                  </tr>
                </thead>
                <tbody className="text-[#333333]">
                  {SCHEDULE_ROWS.map((r) => (
                    <tr key={r.status} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-2">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} aria-hidden />
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{r.flights}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">{r.pilots}</td>
                      <td className="py-2.5 text-right tabular-nums text-[#666666]">{r.coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${LINK} mt-4 block text-left`}>
              View full schedule →
            </button>
          </div>
        </div>

        <div className={`${CARD} xl:col-span-1`}>
          <div className={CARD_HEAD}>
            <h2 className="text-center text-lg font-extrabold text-white">Fleet Status</h2>
          </div>
          <div className={`${CARD_BODY} pt-2`}>
            <FleetDonut />
          </div>
        </div>

        <div className={`${CARD} flex flex-col xl:col-span-1`}>
          <div className={CARD_HEAD}>
            <h2 className="text-lg font-extrabold text-white">Today&apos;s Ops Brief</h2>
          </div>
          <div className={`${CARD_BODY} flex flex-1 flex-col`}>
            <ul className="flex-1 space-y-3">
              {OPS_BRIEF.map((item) => (
                <li
                  key={item.title}
                  className="rounded-sm border border-slate-200/90 bg-[#f1f5f9] px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-[#17324d]">{item.title}</p>
                  <p className="text-xs text-[#666666]">{item.detail}</p>
                </li>
              ))}
            </ul>
            <button type="button" className={`${BTN_PRIMARY} mt-5`}>
              Open Ops Brief
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Pilots and alerts">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <h2 className="text-lg font-extrabold text-white">Pilot Readiness &amp; Compliance</h2>
          </div>
          <div className={CARD_BODY}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-[#17324d]">
                    <th className="pb-2 pr-3">Pilot</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Medical</th>
                    <th className="pb-2 pr-3">Certifications</th>
                    <th className="pb-2 pr-3">Training</th>
                    <th className="pb-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {PILOT_ROWS.map((p) => (
                    <tr key={p.name} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#17324d]">{p.name}</p>
                        <p className="text-xs text-[#666666]">{p.line}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${p.statusStyle}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td
                        className={`py-3 pr-3 text-xs ${p.status === "Not Ready" ? "text-red-600" : "text-[#333333]"}`}
                      >
                        {p.medical}
                      </td>
                      <td
                        className={`py-3 pr-3 text-xs ${p.certs.includes("overdue") ? "text-red-600" : "text-[#333333]"}`}
                      >
                        {p.certs}
                      </td>
                      <td className="py-3 pr-3 text-xs text-[#333333]">{p.training}</td>
                      <td className={`py-3 text-xs font-medium ${p.flagTone || "text-[#666666]"}`}>{p.flags}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className={`${LINK} mt-4 block text-left`}>
              View all pilot profiles →
            </button>
          </div>
        </div>

        <div className={CARD}>
          <div className={`${CARD_HEAD} flex items-center justify-between gap-2`}>
            <h2 className="text-lg font-extrabold text-white">Alerts &amp; Notifications</h2>
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">3</span>
          </div>
          <div className={CARD_BODY}>
            <ul className="space-y-3">
              {ALERT_ITEMS.map((a) => (
                <li
                  key={a.title}
                  className={`flex gap-3 rounded-sm border border-slate-100 border-l-4 py-3 pl-3 pr-3 ${a.tone}`}
                >
                  <AlertRowIcon kind={a.icon} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#17324d]">{a.title}</p>
                    <p className="text-xs text-[#666666]">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className={`${LINK} mt-4 block text-left`}>
              View all alerts →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
