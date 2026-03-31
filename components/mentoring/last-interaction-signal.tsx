import {
  formatLastInteractionLabel,
  getLastInteractionRecency,
  type LastInteractionRecency,
} from "@/lib/mentoring/last-interaction";

type Props = {
  at: string | null;
  className?: string;
  /** Smaller padding/type for dense cards (e.g. My Mentees). */
  compact?: boolean;
};

const RECENCY_STYLES: Record<
  LastInteractionRecency,
  { text: string; dot: string; bubble: string }
> = {
  none: {
    text: "text-slate-500",
    dot: "bg-slate-500",
    bubble: "border border-slate-600/50 bg-slate-800/40",
  },
  fresh: {
    text: "text-emerald-200",
    dot: "bg-emerald-400",
    bubble: "border border-emerald-500/40 bg-emerald-500/[0.12]",
  },
  recent: {
    text: "text-sky-200",
    dot: "bg-sky-400",
    bubble: "border border-sky-500/40 bg-sky-500/[0.12]",
  },
  aging: {
    text: "text-amber-200",
    dot: "bg-amber-400",
    bubble: "border border-amber-500/40 bg-amber-500/[0.12]",
  },
  stale: {
    text: "text-red-200",
    dot: "bg-red-400",
    bubble: "border border-red-500/40 bg-red-500/[0.12]",
  },
};

export function LastInteractionSignal({ at, className = "", compact = false }: Props) {
  const recency = getLastInteractionRecency(at);
  const label = formatLastInteractionLabel(at);
  const s = RECENCY_STYLES[recency];

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md font-medium antialiased ${s.bubble} ${s.text} ${compact ? "gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs leading-none" : "gap-1.5 px-2.5 py-1 text-sm"} ${className}`.trim()}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-md ${s.dot}`}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="opacity-90">Last Interaction:</span>{" "}
        <span className="tabular-nums">{label}</span>
      </span>
    </span>
  );
}
