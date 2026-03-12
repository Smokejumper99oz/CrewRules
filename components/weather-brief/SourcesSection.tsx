const SOURCES = [
  { label: "METAR / TAF", url: "https://aviationweather.gov" },
  { label: "NOTAMs", url: "https://notams.aim.faa.gov/notamSearch" },
  { label: "FAA NAS Status", url: "https://nasstatus.faa.gov" },
  { label: "SIGMETs / AIRMETs", url: "https://aviationweather.gov/sigmet" },
  { label: "PIREPs", url: "https://aviationweather.gov/data/pirep/" },
  { label: "Radar", url: "https://radar.weather.gov/" },
];

export function SourcesSection() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <h3 className="text-lg font-semibold text-white">Official Sources</h3>
      <p className="mt-1 text-sm text-slate-400">
        Click to open in a new tab.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SOURCES.map((s) => (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] touch-manipulation flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white active:bg-white/10"
          >
            <span>{s.label}</span>
            <span className="text-slate-500">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}
