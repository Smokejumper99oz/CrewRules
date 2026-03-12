import type { ReactNode } from "react";
import type { OperationalWatchItem } from "@/lib/weather-brief/types";
import { AlertTriangle, Cloud, Info } from "lucide-react";

type Props = {
  items: OperationalWatchItem[];
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-slate-500/30 bg-slate-500/10",
  caution: "border-amber-500/50 bg-amber-500/25 text-amber-100",
  warning: "border-red-500/40 bg-[#2a0f14] text-white",
};

const SEVERITY_ICONS: Record<string, ReactNode> = {
  warning: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />,
  caution: <Cloud className="h-4 w-4 shrink-0" aria-hidden />,
  info: <Info className="h-4 w-4 shrink-0" aria-hidden />,
};

export function OperationalWatchItems({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <h3 className="text-lg font-semibold text-white">Operational Watch</h3>
      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className={`min-w-0 overflow-hidden rounded-lg border p-3 ${SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.info}`}
          >
            <p className="flex items-center gap-2 font-semibold text-white">
              {SEVERITY_ICONS[item.severity] ?? <Info className="h-4 w-4 shrink-0" aria-hidden />}
              {item.title || "Not available"}
            </p>
            <p className="mt-2 break-words text-sm text-white/90">{item.detail || "Not available"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
