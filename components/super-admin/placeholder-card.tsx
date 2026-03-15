import type { ReactNode } from "react";

type PlaceholderCardProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  variant?: "default" | "compact" | "muted" | "chip";
};

export function PlaceholderCard({
  title,
  subtitle = "Not yet wired",
  icon,
  variant = "default",
}: PlaceholderCardProps) {
  if (variant === "chip") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-600/40 bg-slate-800/20 px-2 py-1 text-xs text-slate-500">
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{title}</span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-600/40 bg-slate-800/20 px-3 py-2">
        {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-400">{title}</div>
          <div className="text-[10px] text-slate-600">{subtitle}</div>
        </div>
      </div>
    );
  }

  if (variant === "muted") {
    return (
      <div className="rounded-lg border border-slate-700/30 bg-slate-800/20 px-3 py-2 flex items-center gap-2">
        {icon && <span className="shrink-0 text-slate-600">{icon}</span>}
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className="text-[10px] text-slate-600">{subtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-600/50 bg-slate-800/30 px-4 py-3 flex items-start gap-3">
      {icon && <div className="shrink-0 text-slate-500 mt-0.5">{icon}</div>}
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-300">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}
