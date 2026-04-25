const CARDS = [
  "Schedule visibility",
  "Pilot readiness",
  "Maintenance coordination",
  "Fatigue and compliance",
  "Request live walkthrough",
] as const;

export default function Demo135OpsAdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">CrewRules Ops Demo</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Part 91 / 135 management portal preview — placeholder modules for a future ops surface.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((title) => (
          <li
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">Coming in a future release.</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
