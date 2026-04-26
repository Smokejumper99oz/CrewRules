import { SystemUpdatesChangelog } from "@/components/portal/system-updates-changelog";
import { SYSTEM_UPDATES_CHANGELOG } from "@/lib/portal/system-updates-changelog";

function currentMonthKeyNow(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function UpdatesPage() {
  const currentMonthKey = currentMonthKeyNow();

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6">
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">System Updates</h1>
        <p className="mt-2 text-slate-300">
          Track new features, improvements, and fixes across CrewRules™.
        </p>
      </div>
      <SystemUpdatesChangelog entries={SYSTEM_UPDATES_CHANGELOG} currentMonthKey={currentMonthKey} />
    </div>
  );
}
