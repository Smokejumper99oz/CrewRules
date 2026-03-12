"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  metarRaw?: string | null;
  tafRaw?: string | null;
  airport: string;
  sourceUrl: string;
};

export function RawWeatherModal({
  open,
  onClose,
  metarRaw,
  tafRaw,
  airport,
  sourceUrl,
}: Props) {
  if (!open) return null;

  const hasMetar = !!metarRaw?.trim();
  const hasTaf = !!tafRaw?.trim();
  const isEmpty = !hasMetar && !hasTaf;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-4 right-4 top-1/2 z-50 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-xl md:left-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2 md:p-6"
        role="dialog"
        aria-labelledby="raw-weather-title"
        aria-modal="true"
      >
        <h2 id="raw-weather-title" className="text-lg font-semibold text-white">
          Raw Weather — {airport || "—"}
        </h2>

        <div className="mt-5 space-y-5">
          {/* METAR section */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              METAR
            </p>
            {hasMetar ? (
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-slate-950/80 p-4 font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
                {metarRaw}
              </pre>
            ) : (
              <p className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-500 italic">
                Not available
              </p>
            )}
          </div>

          {/* TAF section */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              TAF
            </p>
            {hasTaf ? (
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-slate-950/80 p-4 font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
                {tafRaw}
              </pre>
            ) : (
              <p className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-500 italic">
                TAF not available for this station
              </p>
            )}
          </div>

          {isEmpty && (
            <p className="text-sm text-slate-400">
              No raw weather data available. Check Aviation Weather for the latest.
            </p>
          )}
        </div>

        {/* Footer: source link + close */}
        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] touch-manipulation flex items-center text-sm font-medium text-[#75C043] hover:underline"
          >
            View on Aviation Weather →
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] touch-manipulation shrink-0 rounded-lg border border-white/20 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 active:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
