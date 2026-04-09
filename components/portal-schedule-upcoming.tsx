import {
  getNextDuty,
  getUpcomingEvents,
  getScheduleDisplaySettings,
  getTrainingCityForEvent,
} from "@/app/frontier/pilots/portal/schedule/actions";
import { iataToCityName } from "@/lib/family-view/translate-schedule";
import { scheduleCardLegDateHelpers, withLegsToShow } from "@/lib/schedule-card-legs";
import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleEventCard } from "@/components/schedule-event-card";
import {
  computeLegDates,
  getNextActionableLeg,
  getTripDateStrings,
} from "@/lib/leg-dates";
import { getTripReportNightMeta, isRdPlaceholderEvent } from "@/lib/schedule-report-night";
import { extractPairingKey, subtractMinutesFromTime, type TimeDisplayOptions } from "@/lib/schedule-time";
import { formatInTimeZone } from "date-fns-tz";
import { getDisplayedTripDayInfo } from "@/lib/trips/displayed-trip-day";

type DutyDayRow = {
  event: ScheduleEvent;
  displayDateStr: string | null;
  legsToShow: ScheduleEventLeg[] | null;
  reportTimeOverride?: string | null;
  headerTitleOverride: string | null;
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

function legPairingIndex(legs: ScheduleEventLeg[], leg: ScheduleEventLeg): number {
  const i = legs.indexOf(leg);
  if (i >= 0) return i;
  return legs.findIndex(
    (l) =>
      l.origin === leg.origin &&
      l.destination === leg.destination &&
      (l.depTime ?? "") === (leg.depTime ?? "") &&
      (l.flightNumber ?? "") === (leg.flightNumber ?? "")
  );
}

/**
 * Last leg index shown on the primary Next duty / Later today card for this trip.
 * Upcoming must start after this so we never duplicate that leg.
 */
function primaryDashboardLastLegIndex(
  nextDuty: Awaited<ReturnType<typeof getNextDuty>>,
  event: ScheduleEvent,
  tripDateStrs: string[],
  tz: string,
  releaseBufferMinutes: number
): number | null {
  if (nextDuty.event?.id !== event.id || event.event_type !== "trip" || !event.legs?.length) return null;
  const legs = event.legs;
  if (nextDuty.legsToShow?.length) {
    let max = -1;
    for (const sl of nextDuty.legsToShow) {
      const ix = legPairingIndex(legs, sl);
      if (ix > max) max = ix;
    }
    if (max >= 0) return max;
  }
  const next = getNextActionableLeg(legs, tripDateStrs, tz, releaseBufferMinutes);
  if (!next) return null;
  const ix = legPairingIndex(legs, next);
  return ix >= 0 ? ix : null;
}

function expandToDutyDays(
  events: ScheduleEvent[],
  timeOpts: TimeDisplayOptions,
  tz: string,
  hasSchedule: boolean,
  releaseBufferMinutes: number,
  trimLegsAfterIndexForEventId: string | null,
  trimAfterLegIndex: number | null,
  baseAirport: string
): DutyDayRow[] {
  const baseNorm = baseAirport.trim().toUpperCase();
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

      /** Departure-side only; excludes arrival-only calendar touches (overnight leg duplicate rows). */
      const legs = legDateRows
        .filter((row) => row.departureDate === dateStr)
        .map((row) => row.leg);

      if (!reportNightThisDay && legs.length === 0) continue;
      emittedDays.push({ dateStr, legs });
    }

    const dayInfo = getDisplayedTripDayInfo(event, tz, { releaseBufferMinutes });
    const allLegs = event.legs ?? [];
    const displayedTotal =
      dayInfo.bucketIds.length === allLegs.length ? dayInfo.displayedTripLength : emittedDays.length;

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
      /** Dedupe by first visible leg index so the same pairing leg never renders twice (bucket dayNum alone can differ). */
      const seenEmittedLegKeys = new Set<string>();
      for (let idx = 0; idx < emittedDays.length; idx++) {
        const { dateStr, legs } = emittedDays[idx]!;
        const dayLegs = legs;
        const firstDepartingLeg = legDateRows.find((row) => row.departureDate === dateStr)?.leg;
        const cardPrep =
          dayLegs.length > 0
            ? withLegsToShow(
                event,
                dateStr,
                tz,
                "next_duty",
                hasSchedule,
                scheduleCardLegDateHelpers,
                releaseBufferMinutes,
                dateStr
              )
            : null;

        let rowLegsToShow = cardPrep?.legsToShow ?? null;
        let rowDisplayDateStr = cardPrep?.displayDateStr ?? dateStr;
        const shouldTrimContinuationLegs =
          !!trimLegsAfterIndexForEventId &&
          typeof trimAfterLegIndex === "number" &&
          event.id === trimLegsAfterIndexForEventId;

        if (shouldTrimContinuationLegs) {
          const allEventLegs = event.legs ?? [];
          const trimIdx = trimAfterLegIndex;
          const sourceLegsForTrim = rowLegsToShow ?? dayLegs;
          rowLegsToShow = sourceLegsForTrim.filter(
            (leg) => legPairingIndex(allEventLegs, leg) > trimIdx
          );
          if (rowLegsToShow.length === 0) continue;
          const rows = computeLegDates(allEventLegs, tripDateStrs, tz);
          const firstRow = rows.find((r) => r.leg === rowLegsToShow![0]);
          if (firstRow?.departureDate) rowDisplayDateStr = firstRow.departureDate;
        }

        const firstLegAfterTrim = rowLegsToShow?.[0] ?? dayLegs[0];
        let emittedRowKey: string;
        if (firstLegAfterTrim) {
          const li = legPairingIndex(allLegs, firstLegAfterTrim);
          emittedRowKey = `${event.id}::leg::${li >= 0 ? li : idx}`;
        } else {
          emittedRowKey = `${event.id}::nodate::${dateStr}`;
        }
        if (seenEmittedLegKeys.has(emittedRowKey)) continue;
        seenEmittedLegKeys.add(emittedRowKey);

        /** Duty day from the first *visible* leg (after trim), not the calendar day’s first leg (often already flown). */
        const legForDayIndex = firstLegAfterTrim ?? firstDepartingLeg ?? dayLegs[0];
        let dayNum = idx + 1;
        if (dayInfo.bucketIds.length === allLegs.length && legForDayIndex) {
          const liBucket = legPairingIndex(allLegs, legForDayIndex);
          if (liBucket >= 0) dayNum = dayInfo.bucketIds[liBucket]! + 1;
        }
        const pairingKey = extractPairingKey(event.title);
        const headerTitleOverride =
          dayNum > 1 ? `DAY ${dayNum} OF ${displayedTotal} • ${pairingKey}` : null;

        /** Same first visible leg as the flight line; 45 min before dep when out of base (matches Next Duty). */
        const reportLeg = firstLegAfterTrim;
        const reportOrigin = reportLeg?.origin?.trim().toUpperCase() ?? "";
        const depHm = formatLegDepHm(reportLeg?.depTime);
        const isOutOfBase = !!reportOrigin && !!baseNorm && reportOrigin !== baseNorm;
        const reportTimeOverride =
          isOutOfBase && depHm ? subtractMinutesFromTime(depHm, 45) : undefined;

        out.push({
          event,
          displayDateStr: rowDisplayDateStr,
          legsToShow: rowLegsToShow,
          headerTitleOverride,
          reportTimeOverride,
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

  const timeOpts: TimeDisplayOptions = {
    timezone: displaySettings.baseTimezone,
    timeFormat: displaySettings.timeFormat,
    showTimezoneLabel: displaySettings.showTimezoneLabel,
    baseAirport: displaySettings.baseAirport,
  };
  const tz = displaySettings.baseTimezone;
  const releaseBufferMin = Math.max(0, profile?.commute_release_buffer_minutes ?? 0);
  const baseAirport =
    profile?.base_airport?.trim().toUpperCase() ??
    displaySettings.baseAirport?.trim().toUpperCase() ??
    "";

  /** In-progress / “current” trip on the Dashboard — may have future legs even though `getUpcomingEvents` only returns `start_time >= now`. */
  const nd = nextDuty;
  const continuationEvent =
    nd.event &&
    nd.event.event_type === "trip" &&
    nd.event.legs?.length &&
    nd.label !== "post_duty_release" &&
    nd.label != null
      ? nd.event
      : null;

  let trimForEventId: string | null = null;
  let trimAfterIdx: number | null = null;
  const orderedEvents: ScheduleEvent[] = [];
  const seenPairingStart = new Set<string>();
  const pairingStartKey = (ev: ScheduleEvent) =>
    `${extractPairingKey(ev.title)}|${formatInTimeZone(new Date(ev.start_time), tz, "yyyy-MM-dd")}`;

  if (continuationEvent) {
    const tripDates = getTripDateStrings(continuationEvent.start_time, continuationEvent.end_time, tz);
    const lastPrimaryIdx = primaryDashboardLastLegIndex(nd, continuationEvent, tripDates, tz, releaseBufferMin);
    if (lastPrimaryIdx != null && lastPrimaryIdx < continuationEvent.legs!.length - 1) {
      orderedEvents.push(continuationEvent);
      seenPairingStart.add(pairingStartKey(continuationEvent));
      trimForEventId = continuationEvent.id;
      trimAfterIdx = lastPrimaryIdx;
    }
  }

  for (const e of rawEvents) {
    if (continuationEvent && e.id === continuationEvent.id) continue;
    const pk = pairingStartKey(e);
    if (seenPairingStart.has(pk)) continue;
    seenPairingStart.add(pk);
    orderedEvents.push(e);
  }

  const dutyDayRows = expandToDutyDays(
    orderedEvents,
    timeOpts,
    tz,
    nextDuty.hasSchedule,
    releaseBufferMin,
    trimForEventId,
    trimAfterIdx,
    baseAirport
  );
  dutyDayRows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  const upcomingEvents = dutyDayRows.slice(0, 5);

  if (upcomingEvents.length === 0) return null;

  const trainingLocationByEventId = new Map<string, string>();
  await Promise.all(
    upcomingEvents
      .filter((row) => row.event.event_type === "training")
      .map(async (row) => {
        const e = row.event;
        const iata = await getTrainingCityForEvent(e.title ?? null, e.start_time, e.end_time, e);
        if (iata) trainingLocationByEventId.set(e.id, iataToCityName(iata));
      })
  );

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
              creditMinutesDisplayOverride={
                row.event.event_type === "trip" || row.event.event_type === "training"
                  ? (row.event.baseline_credit_minutes ?? row.event.credit_minutes ?? null)
                  : null
              }
              upcomingTrainingLocationLine={trainingLocationByEventId.get(row.event.id) ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
