import { getNextDuty, getUpcomingEvents, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleEventCard } from "@/components/schedule-event-card";
import { computeLegDates, getTripDateStrings, getLegsForDate } from "@/lib/leg-dates";
import { getTripReportNightMeta, isRdPlaceholderEvent } from "@/lib/schedule-report-night";
import type { TimeDisplayOptions } from "@/lib/schedule-time";
import { formatInTimeZone } from "date-fns-tz";

type DutyDayRow = {
  event: ScheduleEvent;
  displayDateStr: string | null;
  legsToShow: ScheduleEventLeg[] | null;
  reportTimeOverride?: string | null;
  headerTitleOverride: string | null;
  compactTimeLabelOverride?: string | null;
  sortKey: string;
};

/** HH:mm from leg dep HHMM / HMM (display-only). */
function formatLegDepHm(depTime: string | undefined): string | null {
  if (!depTime?.trim()) return null;
  const s = depTime.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const p = s.padStart(4, "0");
  return `${p.slice(0, 2)}:${p.slice(2)}`;
}

function expandToDutyDays(events: ScheduleEvent[], timeOpts: TimeDisplayOptions, tz: string): DutyDayRow[] {
  const out: DutyDayRow[] = [];
  for (const event of events) {
    if (isRdPlaceholderEvent(event)) continue;

    if (event.event_type !== "trip" || !event.legs?.length) {
      out.push({
        event,
        displayDateStr: null,
        legsToShow: null,
        headerTitleOverride: null,
        sortKey: `${formatInTimeZone(new Date(event.start_time), tz, "yyyy-MM-dd")}\0${event.start_time}\0${event.id}`,
      });
      continue;
    }

    const tripDateStrs = getTripDateStrings(event.start_time, event.end_time, tz);
    const meta = getTripReportNightMeta(event, timeOpts);
    const legDateRows = computeLegDates(event.legs, tripDateStrs, tz);

    type EmittedDutyDay = { dateStr: string; legs: ScheduleEventLeg[] };
    const emittedDays: EmittedDutyDay[] = [];

    for (const dateStr of tripDateStrs) {
      const hasDepartingLeg = legDateRows.some((row) => row.departureDate === dateStr);
      const reportNightThisDay = meta.isReportNight && meta.reportLocalDate === dateStr;
      if (!hasDepartingLeg && !reportNightThisDay) continue;

      const legs = getLegsForDate(event.legs, dateStr, tripDateStrs, tz);
      emittedDays.push({ dateStr, legs });
    }

    const emittedTotal = emittedDays.length;

    if (emittedTotal === 0) {
      out.push({
        event,
        displayDateStr: null,
        legsToShow: null,
        headerTitleOverride: null,
        sortKey: `${formatInTimeZone(new Date(event.start_time), tz, "yyyy-MM-dd")}\0${event.start_time}\0${event.id}`,
      });
    } else {
      for (let idx = 0; idx < emittedDays.length; idx++) {
        const { dateStr, legs } = emittedDays[idx]!;
        const dayNum = idx + 1;
        const headerTitleOverride =
          dayNum > 1
            ? `DAY ${dayNum} OF ${emittedTotal} • ${event.title?.trim() || "Untitled"}`
            : null;

        const firstDepartingLeg = legDateRows.find((row) => row.departureDate === dateStr)?.leg;
        const reportTimeOverride =
          dayNum === 1 ? undefined : formatLegDepHm(firstDepartingLeg?.depTime) ?? "—";
        const compactTimeLabelOverride = dayNum > 1 ? "FIRST LEG" : null;

        out.push({
          event,
          displayDateStr: dateStr,
          legsToShow: legs.length > 0 ? legs : null,
          headerTitleOverride,
          reportTimeOverride,
          compactTimeLabelOverride,
          sortKey: `${dateStr}\0${event.start_time}\0${event.id}\0${String(idx).padStart(3, "0")}`,
        });
      }
    }
  }
  return out;
}

export async function PortalScheduleUpcoming({ tenant, portal }: { tenant: string; portal: string }) {
  const [nextDuty, { events: rawEvents }, displaySettings, profile] = await Promise.all([
    getNextDuty(),
    getUpcomingEvents(7),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);
  const excludeId = nextDuty.event?.id;
  const filtered = excludeId ? rawEvents.filter((e) => e.id !== excludeId) : rawEvents.slice();

  const timeOpts: TimeDisplayOptions = {
    timezone: displaySettings.baseTimezone,
    timeFormat: displaySettings.timeFormat,
    showTimezoneLabel: displaySettings.showTimezoneLabel,
    baseAirport: displaySettings.baseAirport,
  };
  const tz = displaySettings.baseTimezone;

  const dutyDayRows = expandToDutyDays(filtered, timeOpts, tz);
  dutyDayRows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  const upcomingEvents = dutyDayRows.slice(0, 5);

  if (upcomingEvents.length === 0) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-400/30 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] dark:hover:border-emerald-400/20">
      <div className="border-b border-slate-200 pb-2 dark:border-white/5">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming</h2>
      </div>
      <ul className="mt-4 space-y-2">
        {upcomingEvents.map((row, i) => (
          <li
            key={`${row.event.id}-${row.displayDateStr ?? "full"}-${row.sortKey}`}
            className={i === 4 ? "xl:hidden" : undefined}
          >
            <ScheduleEventCard
              event={row.event}
              displaySettings={displaySettings}
              position={profile?.position ?? null}
              compact
              legsToShow={row.legsToShow}
              displayDateStr={row.displayDateStr}
              reportTimeOverride={row.reportTimeOverride ?? undefined}
              headerTitleOverride={row.headerTitleOverride}
              compactTimeLabelOverride={row.compactTimeLabelOverride ?? undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
