const ITEMS = [
  "Users online",
  "Active users",
  "Revenue",
  "API spend",
];

export function SuperAdminComingSoonStrip() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
      <span className="text-slate-600">Coming soon:</span>
      {ITEMS.map((label) => (
        <span
          key={label}
          className="rounded-md border border-slate-600/40 bg-slate-800/30 px-2 py-0.5 text-slate-500"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
