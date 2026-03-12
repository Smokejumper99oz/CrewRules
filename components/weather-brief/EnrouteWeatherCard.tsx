import type { EnrouteAdvisory } from "@/lib/weather-brief/types";

type Props = {
  advisories: EnrouteAdvisory[];
};

function hasAdvisoryText(a: EnrouteAdvisory | null | undefined): boolean {
  if (!a) return false;
  const ext = a as { raw_text?: string; text?: string; message?: string };
  const text = ext.raw_text || ext.text || ext.message || a.rawText || a.description || a.title;
  return typeof text === "string" && text.trim().length > 0;
}

export function EnrouteWeatherCard({ advisories }: Props) {
  const validAdvisories = (advisories ?? []).filter(hasAdvisoryText);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <h3 className="text-lg font-semibold text-white">Enroute Advisories</h3>
      {validAdvisories.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">
            No active enroute advisories for this route.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {validAdvisories.map((adv, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="mb-1 text-xs tracking-wide text-sky-400">
                SIGMET
              </div>

              <div className="font-medium">
                {(adv as { raw_text?: string; text?: string; message?: string }).raw_text || (adv as { raw_text?: string; text?: string; message?: string }).text || (adv as { raw_text?: string; message?: string }).message || adv.rawText || adv.description || adv.title}
              </div>

              <a
                href={(adv as { source?: string }).source || adv.sourceUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-[44px] items-center touch-manipulation text-sm text-emerald-400 hover:underline"
              >
                View source →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
