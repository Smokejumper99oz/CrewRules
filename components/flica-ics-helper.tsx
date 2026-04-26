"use client";

const STEPS = [
  {
    step: 1,
    title: "Open FLICA Calendar",
    text: "Go to Tools → FLICA Calendar",
    image: "/help/flica/step-1-flica-menu.png",
  },
  {
    step: 2,
    title: "Export Your Schedule",
    text: "Select your month → Click Go → Click Export Schedule",
    image: "/help/flica/step-2-export.png",
  },
  {
    step: 3,
    title: "Choose export format",
    text: "Select vCalendar v1.0 (.VCS) and continue",
    image: "/help/flica/step-3-vcs.png",
  },
  {
    step: 4,
    title: "Send Schedule",
    text: "Leave everything selected → Click Send",
    image: "/help/flica/step-4-send.png",
  },
  {
    step: 5,
    title: "Upload to CrewRules™",
    text: "Upload the downloaded .VCS file on My Schedule",
    image: "/help/flica/step-5-upload.png",
  },
] as const;

const HIGHLIGHT_COLOR = "#75C043";

export function FlicaIcsHelper() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="space-y-4">
        {STEPS.map(({ step, title, text, image }) => (
          <div
            key={step}
            className="rounded-xl border-2 p-4"
            style={{ borderColor: HIGHLIGHT_COLOR }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: HIGHLIGHT_COLOR }}
              >
                {step}
              </span>
              <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            </div>
            <p className="mb-3 text-sm text-slate-600">{text}</p>
            <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: `${HIGHLIGHT_COLOR}40` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`Step ${step}: ${title}`}
                className="w-full object-contain"
              />
            </div>
          </div>
        ))}
      </div>
      <footer className="mt-6 space-y-1 border-t border-slate-200 pt-4 text-sm text-slate-500">
        <p>File downloads to your Downloads folder</p>
        <p>No need to rename — CrewRules™ detects the month automatically</p>
        <p className="text-slate-600">
          If you previously uploaded a schedule using the .ICS format, tap Clear schedule once and upload your latest .VCS schedule file again.
        </p>
      </footer>
    </div>
  );
}
