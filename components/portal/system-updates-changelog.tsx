import type { SystemUpdateEntry, SystemUpdateType } from "@/lib/portal/system-updates-changelog";
import { SystemUpdatesChangelogMonthDetails } from "@/components/portal/system-updates-changelog-month-details";

const CARD =
  "rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

function compareEntriesNewestFirst(a: SystemUpdateEntry, b: SystemUpdateEntry): number {
  const byDate = b.date.localeCompare(a.date);
  if (byDate !== 0) return byDate;
  return a.title.localeCompare(b.title);
}

function sortedEntriesNewestFirst(entries: readonly SystemUpdateEntry[]): SystemUpdateEntry[] {
  return [...entries].sort(compareEntriesNewestFirst);
}

function monthKeyFromIsoDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function formatMonthHeading(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yyyyMm;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type MonthGroup = { monthKey: string; heading: string; entries: SystemUpdateEntry[] };

function groupByMonthNewestFirst(sortedNewestFirst: SystemUpdateEntry[]): MonthGroup[] {
  const order: string[] = [];
  const byMonth = new Map<string, SystemUpdateEntry[]>();

  for (const entry of sortedNewestFirst) {
    const key = monthKeyFromIsoDate(entry.date);
    if (!byMonth.has(key)) {
      order.push(key);
      byMonth.set(key, []);
    }
    byMonth.get(key)!.push(entry);
  }

  const monthKeysNewestFirst = [...order].sort((a, b) => b.localeCompare(a));

  return monthKeysNewestFirst.map((monthKey) => ({
    monthKey,
    heading: formatMonthHeading(monthKey),
    entries: byMonth.get(monthKey) ?? [],
  }));
}

function typeBadgeLabel(type: SystemUpdateType): string {
  switch (type) {
    case "new_feature":
      return "New feature";
    case "improvement":
      return "Improvement";
    case "fix":
      return "Fix";
  }
}

function typeBadgeClass(type: SystemUpdateType): string {
  const base =
    "shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (type) {
    case "new_feature":
      return `${base} border-emerald-500/40 bg-emerald-500/15 text-emerald-300`;
    case "improvement":
      return `${base} border-sky-500/40 bg-sky-500/15 text-sky-200`;
    case "fix":
      return `${base} border-amber-500/40 bg-amber-500/15 text-amber-200`;
  }
}

function formatDisplayDate(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return isoDate;
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  entries: readonly SystemUpdateEntry[];
  /** Calendar month in `YYYY-MM`, from the server page, for default-open disclosure. */
  currentMonthKey: string;
};

function monthSummaryLine(heading: string, entryCount: number): string {
  const nLabel = entryCount === 1 ? "1 update" : `${entryCount} updates`;
  return `${heading} · ${nLabel}`;
}

export function SystemUpdatesChangelog(props: Props) {
  if (props.entries.length === 0) {
    return (
      <section aria-label="Update history">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Update history</h2>
        <div className={`mt-3 p-6 sm:p-8 ${CARD}`}>
          <p className="text-center text-slate-400 text-sm sm:text-base">
            No release notes yet. Check back after the next CrewRules rollout.
          </p>
        </div>
      </section>
    );
  }

  const { entries, currentMonthKey } = props;
  const rows = sortedEntriesNewestFirst(entries);
  const groups = groupByMonthNewestFirst(rows);

  return (
    <section aria-label="Update history">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Update history</h2>
      <div className="mt-4 space-y-10 sm:space-y-12">
        {groups.map((group) => (
          <SystemUpdatesChangelogMonthDetails
            key={group.monthKey}
            initialOpen={group.monthKey === currentMonthKey}
            summaryLabel={monthSummaryLine(group.heading, group.entries.length)}
          >
            <ul className="mt-4 space-y-4 sm:space-y-5 list-none p-0 m-0">
              {group.entries.map((entry) => (
                <li key={`${entry.date}-${entry.title}`}>
                  <article className={`p-4 sm:p-5 ${CARD}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-400">{formatDisplayDate(entry.date)}</p>
                        <h4 className="mt-1 text-base font-semibold text-white tracking-tight">{entry.title}</h4>
                      </div>
                      <span className={typeBadgeClass(entry.type)}>{typeBadgeLabel(entry.type)}</span>
                    </div>
                    <ul className="mt-4 space-y-2 pl-4 text-sm text-slate-300 list-disc list-outside marker:text-slate-500">
                      {entry.bullets.map((bullet, idx) => (
                        <li key={`${entry.date}-${entry.title}-b${idx}`} className="pl-1">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </article>
                </li>
              ))}
            </ul>
          </SystemUpdatesChangelogMonthDetails>
        ))}
      </div>
    </section>
  );
}
