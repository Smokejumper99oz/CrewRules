import type { PilotSummaryLine } from "@/lib/weather-brief/pilot-summary";

type Props = {
  lines: PilotSummaryLine[];
};

/**
 * Presentation-only: capitalize the first letter after ":" or em-dash or spaced hyphen,
 * without altering fetch/decode logic (applied to server-built strings at render time).
 */
function formatPilotSummaryLineText(text: string): string {
  let result = text;
  result = result.replace(/([:—])(\s*)([a-z])/g, (_m, delim: string, sp: string, ch: string) => delim + sp + ch.toUpperCase());
  result = result.replace(/(\s-\s+)([a-z])/g, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
  return result;
}

export function PilotSummary({ lines }: Props) {
  if (!lines.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <h3 className="text-lg font-semibold text-white">Pilot Summary</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 font-medium text-slate-400">{line.label}:</span>
            <span className="min-w-0 text-pretty">{formatPilotSummaryLineText(line.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
