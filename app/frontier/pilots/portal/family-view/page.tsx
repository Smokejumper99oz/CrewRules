import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { flightAwareUrl } from "@/lib/airlines";
import { FamilyViewPhoneFrame } from "@/components/family-view-phone-frame";
import { FamilyViewGlossary } from "@/components/family-view-glossary";
import { FamilyViewTodayCommuteFlights } from "@/components/family-view-today-commute-flights";
import { resolveLang, getStrings, SUPPORTED_LANGS } from "@/lib/family-view/family-view-i18n";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import type { CommuteFlight } from "@/lib/aviationstack";
import {
  CalendarDays,
  PlaneTakeoff,
  MapPin,
  Clock,
  Home,
  User,
} from "lucide-react";
import { getProfile, getDisplayName } from "@/lib/profile";
import { getScheduleEvents, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import {
  getTodayStatus,
  getNextTripSummary,
  getThisWeekDays,
  getUpcomingDays,
  getFamilyViewSettings,
  getTripDayItems,
  getBetweenTripStatus,
  formatReportTime12h,
  formatReportTimeForDisplay,
  formatReportTimeOfDay,
  formatStatusForDisplay,
  iataToCityName,
  isSameRegionAirports,
} from "@/lib/family-view/translate-schedule";
import Image from "next/image";
import { addDays, differenceInCalendarDays } from "date-fns";
import { getTripDateStrings, todayStr } from "@/lib/leg-dates";
import { getDaysAwayFromHome } from "@/lib/family-view/days-away-from-home";
import { isCommuter, getCommuteInfoForTrip } from "@/lib/family-view/commute-inference";

const iconClass = "size-4 shrink-0 text-[#7A7A7A]";
export default async function FamilyViewPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; lang?: string }>;
}) {
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams?.tab === "glossary" ? "glossary" : "schedule";
  const lang = resolveLang(resolvedParams?.lang);
  const s = getStrings(lang);
  const langParam = lang === "en" ? "" : `&lang=${lang}`;
  // German uses 24h clock; EN/ES use 12h AM/PM
  const timeFormat = lang === "de" ? "HH:mm" : "h:mm a";

  // German full day/month names; Spanish abbreviated day names
  const DE_DAYS = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  const DE_MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const ES_DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const ES_MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  /** Return a language-appropriate day label from a dateStr like "2026-04-07". Falls back to the pre-computed English label. */
  function localDayLabel(dateStr: string, englishLabel: string): string {
    if (lang === "en") return englishLabel;
    const parts = dateStr.split("-").map(Number);
    const y = parts[0] ?? 0, m = parts[1] ?? 1, d = parts[2] ?? 1;
    const jsDate = new Date(y, m - 1, d);
    const dow = jsDate.getDay();
    if (lang === "de") {
      const dayName = DE_DAYS[dow] ?? englishLabel;
      const monthName = DE_MONTHS[m - 1] ?? "";
      return `${dayName} • ${d}. ${monthName}`;
    }
    if (lang === "es") {
      const dayName = ES_DAYS[dow] ?? englishLabel;
      const monthName = ES_MONTHS[m - 1] ?? "";
      return `${dayName} • ${monthName} ${d}`;
    }
    return englishLabel;
  }
  // Format a HH:MM schedule string (leg times, report times) for display
  function fmtTime(hhMM: string | null | undefined): string {
    if (!hhMM) return "";
    if (lang === "de") {
      // Already HH:mm — just normalise to HH:mm
      const s2 = hhMM.trim().replace(":", "");
      if (!/^\d{3,4}$/.test(s2)) return hhMM;
      const h = parseInt(s2.slice(0, -2) || "0", 10);
      const m = parseInt(s2.slice(-2), 10);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return formatReportTime12h(hhMM);
  }
  const [profile, displaySettings, { events }] = await Promise.all([
    getProfile(),
    getScheduleDisplaySettings(),
    (async () => {
      const now = new Date();
      const fromIso = now.toISOString();
      const toDate = addDays(now, 35);
      const toIso = toDate.toISOString();
      return getScheduleEvents(fromIso, toIso);
    })(),
  ]);

  const baseTimezone = displaySettings.baseTimezone ?? "America/Denver";
  const settings = getFamilyViewSettings(profile);

  const todayStatus = getTodayStatus(events, profile, baseTimezone, settings);
  const nextTrip = getNextTripSummary(events, profile, baseTimezone, settings);
  const thisWeek = getThisWeekDays(events, profile, baseTimezone, settings);
  const upcomingAll = getUpcomingDays(events, profile, baseTimezone, settings, 7, 28);

  const isEnabled = profile?.family_view_enabled ?? false;

  const commuteFlightsCache = new Map<
    string,
    Awaited<ReturnType<typeof getCommuteFlights>>
  >();
  const commuteCacheKey = (o: string, d: string, date: string) =>
    `${o.toUpperCase()}:${d.toUpperCase()}:${date}`;
  const cachedGetCommuteFlights = async (p: {
    origin: string;
    destination: string;
    date: string;
  }) => {
    const key = commuteCacheKey(p.origin, p.destination, p.date);
    const cached = commuteFlightsCache.get(key);
    if (cached !== undefined) return cached;
    const res = await getCommuteFlights(p);
    commuteFlightsCache.set(key, res);
    return res;
  };

  const daysAway = nextTrip
    ? await getDaysAwayFromHome({
        trip: nextTrip.event,
        profile,
        baseTimezone,
        settings,
        getCommuteFlights: async (p) => {
          const res = await cachedGetCommuteFlights(p);
          return res.ok ? { ok: true as const, flights: res.flights, originTz: res.originTz, destTz: res.destTz } : { ok: false as const };
        },
      })
    : 0;
  const nightsCount = nextTrip?.overnightNightsCount ?? 0;

  // Compute total consecutive days away from home — walks backwards through prior trips
  // that had too little gap for the pilot to return home, extending the "away" count.
  const totalDaysAway = (() => {
    if (!nextTrip || !isCommuter(profile)) return daysAway;
    const homeAirport = (profile?.home_airport ?? "").trim().toUpperCase();
    const baseAirport = (profile?.base_airport ?? "").trim().toUpperCase();
    const thresholdHours = isSameRegionAirports(homeAirport, baseAirport) ? 8 : 48;

    // All trips that ended before the current one, most-recent first
    const priorTrips = events
      .filter((e) => e.event_type === "trip" && e.end_time < nextTrip.event.start_time)
      .sort((a, b) => b.end_time.localeCompare(a.end_time));

    // Walk back through consecutive trips where gap was too short to go home
    let chainStartTrip = nextTrip.event;
    for (const prior of priorTrips) {
      const gapHours =
        (new Date(chainStartTrip.start_time).getTime() - new Date(prior.end_time).getTime()) /
        3_600_000;
      if (gapHours >= thresholdHours) break;
      chainStartTrip = prior;
    }

    if (chainStartTrip === nextTrip.event) return daysAway; // no prior chain

    // Leave date = commute departure for the earliest trip in the chain
    const commuteInfo = getCommuteInfoForTrip(chainStartTrip, profile, baseTimezone);
    const leaveDate =
      commuteInfo?.commuteDateStr ??
      formatInTimeZone(new Date(chainStartTrip.start_time), baseTimezone, "yyyy-MM-dd");

    // Return date = the day daysAway ends (leaveHomeDate of current trip + daysAway)
    // Approximate by using current trip end + 1 day for return commute
    const currentTripEndDate = formatInTimeZone(
      new Date(nextTrip.event.end_time),
      baseTimezone,
      "yyyy-MM-dd"
    );
    const returnDate = addDays(new Date(currentTripEndDate + "T12:00:00.000Z"), 1)
      .toISOString()
      .slice(0, 10);

    const diff = differenceInCalendarDays(
      new Date(returnDate + "T12:00:00.000Z"),
      new Date(leaveDate + "T12:00:00.000Z")
    );
    return Math.max(daysAway, diff + 1);
  })();

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? getDisplayName(profile).split(/\s+/)[0];
  const commuteTitle = firstName ? `${firstName}'s Commute Options` : "Commute Options";

  const tripDayItems = nextTrip
    ? getTripDayItems(nextTrip.event, events, profile, baseTimezone, settings)
    : [];

  const betweenTripStatus = nextTrip
    ? getBetweenTripStatus(nextTrip.event, events, profile, baseTimezone, firstName ?? null)
    : null;

  // Used to localize the trip date range header and "Home [day]" row
  const currentTripFirstDayStr = nextTrip
    ? formatInTimeZone(new Date(nextTrip.event.start_time), baseTimezone, "yyyy-MM-dd")
    : null;
  const currentTripLastDayStr = nextTrip
    ? formatInTimeZone(new Date(nextTrip.event.end_time), baseTimezone, "yyyy-MM-dd")
    : null;

  // Used to localize the "Next trip starts …" label in the between-trip warning
  const afterCurrentTripEvent = nextTrip
    ? events.find((e) => e.event_type === "trip" && e.start_time > nextTrip.event.end_time) ?? null
    : null;
  const afterCurrentTripFirstDayStr = afterCurrentTripEvent
    ? formatInTimeZone(new Date(afterCurrentTripEvent.start_time), baseTimezone, "yyyy-MM-dd")
    : null;

  // Live status for each operating leg today (delay / cancellation)
  type TodayLegLiveStatus = {
    cancelled: boolean;
    depDelayMin: number | null;
    arrDelayMin: number | null;
  };
  const legLiveStatuses: TodayLegLiveStatus[] = [];
  if (todayStatus.todayLegs && todayStatus.todayLegs.length > 0) {
    for (const leg of todayStatus.todayLegs) {
      const blank: TodayLegLiveStatus = { cancelled: false, depDelayMin: null, arrDelayMin: null };
      if (!leg.originIata || !leg.destIata || !leg.departureDate) {
        legLiveStatuses.push(blank);
        continue;
      }
      try {
        const res = await cachedGetCommuteFlights({
          origin: leg.originIata,
          destination: leg.destIata,
          date: leg.departureDate,
        });
        if (res.ok && res.flights) {
          const fullNum = `${leg.carrierCode ?? ""}${leg.flightNumeric ?? ""}`.toUpperCase();
          const match = res.flights.find(
            (f) => f.flightNumber.toUpperCase() === fullNum
          );
          if (match) {
            legLiveStatuses.push({
              cancelled: match.status?.toLowerCase() === "cancelled",
              depDelayMin: typeof match.dep_delay_min === "number" ? match.dep_delay_min : null,
              arrDelayMin: typeof match.arr_delay_min === "number" ? match.arr_delay_min : null,
            });
          } else {
            legLiveStatuses.push(blank);
          }
        } else {
          legLiveStatuses.push(blank);
        }
      } catch {
        legLiveStatuses.push({ cancelled: false, depDelayMin: null, arrDelayMin: null });
      }
    }
  }

  let commuteFlightsData: {
    flights: { flight: CommuteFlight; label: "Likely your flight" | "Backup option" }[];
    originTz: string;
    destTz: string;
  } | null = null;
  if (
    todayStatus.status === "Likely Commuting" &&
    nextTrip?.commuteInfo &&
    profile?.home_airport &&
    (profile?.base_airport || nextTrip.event.legs?.[0]?.origin)
  ) {
    const origin = (profile.home_airport ?? "").trim().toUpperCase();
    const destination = (
      nextTrip.event.legs?.[0]?.origin ?? profile.base_airport ?? ""
    )
      .trim()
      .toUpperCase();
    const date = nextTrip.commuteInfo.commuteDateStr;
    if (origin.length === 3 && destination.length === 3) {
      const res = await cachedGetCommuteFlights({ origin, destination, date });
      if (res.ok && res.flights && res.flights.length > 0) {
        const f9 = res.flights.filter(
          (f) => (f.carrier ?? "").trim().toUpperCase() === "F9"
        );
        const others = res.flights.filter(
          (f) => (f.carrier ?? "").trim().toUpperCase() !== "F9"
        );
        const ranked = [...f9, ...others].slice(0, 2);
        const labeled = ranked.map((flight, i) => ({
          flight,
          label: (i === 0 && (flight.carrier ?? "").trim().toUpperCase() === "F9"
            ? "Likely your flight"
            : "Backup option") as "Likely your flight" | "Backup option",
        }));
        commuteFlightsData = {
          flights: labeled,
          originTz: res.originTz ?? "America/Denver",
          destTz: res.destTz ?? "America/Denver",
        };
      }
    }
  }

  return (
    <FamilyViewPhoneFrame>
    <div className="max-w-full lg:max-w-[1200px] xl:max-w-[1320px] lg:mx-auto">
    <div className="rounded-[28px] lg:rounded-2xl bg-[#F7F6F2] p-5 sm:p-8 lg:p-8 xl:p-10 shadow-sm" data-family-view-canvas>
      <div className="space-y-8">
      {/* Disabled state when Family View is off */}
      {!isEnabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 shadow-sm">
          <p className="font-medium text-amber-800">{s.familyViewDisabled}</p>
          <p className="mt-1 text-sm text-[#2F2F2F]">
            <Link href="/frontier/pilots/portal/settings/family-view" className="text-[#7FB069] hover:underline">
              {s.familyViewDisabledLink}
            </Link>{" "}
            {s.familyViewDisabledSuffix}
          </p>
        </div>
      )}

      {/* Header - extends to top/sides to fill like mockup */}
      <div className="-mx-5 -mt-5 flex items-center justify-between gap-3 rounded-t-[28px] bg-[#F4F1EA] px-5 pt-2 pb-4 sm:-mx-8 sm:-mt-8 sm:px-8 sm:pt-2 lg:-mx-8 lg:-mt-8 lg:rounded-t-2xl lg:px-8 lg:pt-2 xl:-mx-10 xl:-mt-10 xl:px-10 xl:pt-2">
        <h1 className="min-w-0 text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
          <span className="text-[#2F4F46]">Crew</span><span className="text-[#7FB069]">Rules</span><sup className="text-[#2F4F46]">™</sup>{" "}
          <span className="text-[#2F2F2F]">{s.familyView}</span>
        </h1>
        {/* Language switcher — flag-gradient circles */}
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EDE9E2] px-1.5 py-1.5 shadow-sm min-h-[44px]">
          {(["en", "es", "de"] as const).map((l) => {
            const flagBg =
              l === "en"
                // USA: blue canton top, then alternating red/white stripes
                ? "linear-gradient(180deg,#3C3B6E 0% 34%,#B22234 34% 52%,#fff 52% 62%,#B22234 62% 74%,#fff 74% 84%,#B22234 84%)"
                : l === "es"
                // Puerto Rico: blue triangle left + red/white stripes
                ? "linear-gradient(to right,#002A8F 0% 34%,transparent 34%),repeating-linear-gradient(180deg,#EF3340 0px 20%,#fff 20% 40%)"
                // Germany: black / red / gold horizontal bands
                : "linear-gradient(180deg,#000 0% 33.3%,#CC0000 33.3% 66.6%,#FFCE00 66.6%)";
            const isActive = lang === l;
            return (
              <Link
                key={l}
                href={`?tab=${activeTab}${l === "en" ? "" : `&lang=${l}`}`}
                style={{ background: flagBg }}
                className={`relative inline-flex touch-manipulation min-h-[36px] min-w-[36px] items-center justify-center rounded-full transition-all duration-150 ${
                  isActive
                    ? "ring-2 ring-[#2F4F46] ring-offset-1 scale-110 opacity-100"
                    : "opacity-50 hover:opacity-75"
                }`}
              >
                <span
                  className="text-[11px] font-bold leading-none select-none"
                  style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.75), 0 0 8px rgba(0,0,0,0.4)" }}
                >
                  {l.toUpperCase()}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="-mx-5 sm:-mx-8 lg:-mx-8 xl:-mx-10 px-5 sm:px-8 lg:px-8 xl:px-10 bg-[#F4F1EA] pt-2 pb-0 mb-6 border-b border-[#E8E3DA]">
        <div className="flex gap-0">
          <Link
            href={`?tab=schedule${langParam}`}
            className={`inline-flex min-h-[44px] touch-manipulation items-center px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "schedule"
                ? "border-[#4A6741] text-[#2F4F46]"
                : "border-transparent text-[#9A9A9A] hover:text-[#4A6741]"
            }`}
          >
            {s.tabSchedule}
          </Link>
          <Link
            href={`?tab=glossary${langParam}`}
            className={`inline-flex min-h-[44px] touch-manipulation items-center px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "glossary"
                ? "border-[#4A6741] text-[#2F4F46]"
                : "border-transparent text-[#9A9A9A] hover:text-[#4A6741]"
            }`}
          >
            {s.tabAviationTerms}
          </Link>
        </div>
      </div>

      {activeTab === "glossary" ? (
        <FamilyViewGlossary lang={lang} s={s} />
      ) : (
      <>{/* Section 1: Today */}
      <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
          {s.sectionToday}
        </h2>
        {commuteFlightsData ? (
          <>
            <p className="text-lg font-medium text-[#2F2F2F] mb-3">
              {commuteTitle}
            </p>
            <FamilyViewTodayCommuteFlights
              flights={commuteFlightsData.flights}
              originTz={commuteFlightsData.originTz}
              destTz={commuteFlightsData.destTz}
              s={s}
              use24h={lang === "de"}
            />
          </>
        ) : (
          <div className="rounded-xl border border-[#E8E3DA] bg-white px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-medium text-[#2F2F2F]">
                {todayStatus.status === "Overnight Away"
                  ? s.overnight
                  : todayStatus.status === "At Work"
                  ? s.dutyStarts
                  : todayStatus.status === "Expected Home"
                  ? s.comingHome
                  : todayStatus.status === "Day Off"
                  ? s.dayOff
                  : todayStatus.status === "On Call"
                  ? s.onCall
                  : todayStatus.status === "Likely Commuting"
                  ? s.headingToWork
                  : formatStatusForDisplay(todayStatus.status)}
              </span>
              {todayStatus.tripDayLabel && (() => {
                const m = todayStatus.tripDayLabel.match(/Day (\d+) of (\d+)/);
                const label = m ? `${s.day} ${m[1]} ${s.of} ${m[2]}` : todayStatus.tripDayLabel;
                return (
                  <span className="shrink-0 rounded-full bg-[#EDE9E2] px-2.5 py-0.5 text-xs font-medium text-[#4A6741]">
                    {label}
                  </span>
                );
              })()}
            </div>
            {todayStatus.detail && (
              <p className="flex items-center gap-2 text-sm text-[#6F6F6F]">
                <MapPin className={iconClass} aria-hidden />
                {s.currently} {todayStatus.detail}
              </p>
            )}
            {todayStatus.todayLegs && todayStatus.todayLegs.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6F6F6F]">
                  <PlaneTakeoff className="size-3.5 shrink-0 text-[#7A7A7A]" aria-hidden />
                  {s.flyingToday}
                </p>
                {todayStatus.todayLegs.map((leg, i) => {
                  const live = legLiveStatuses[i] ?? { cancelled: false, depDelayMin: null, arrDelayMin: null };
                  const hasDelay = !live.cancelled && ((live.depDelayMin ?? 0) > 0 || (live.arrDelayMin ?? 0) > 0);
                  const delayMin = live.depDelayMin ?? live.arrDelayMin ?? 0;
                  // Shift HH:MM by delay minutes for display
                  function shiftTime(hhmm: string, mins: number): string {
                    const [h, m] = hhmm.split(":").map(Number);
                    const total = (h * 60 + m + mins + 1440) % 1440;
                    const nh = Math.floor(total / 60), nm = total % 60;
                    return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
                  }
                  const newDepTime = hasDelay && leg.depTime ? shiftTime(leg.depTime, live.depDelayMin ?? 0) : null;
                  const newArrTime = hasDelay && leg.arrTime ? shiftTime(leg.arrTime, live.arrDelayMin ?? live.depDelayMin ?? 0) : null;
                  return (
                  <div key={i} className={`rounded-lg border bg-[#F9F8F5] px-3 py-2 space-y-1.5 ${live.cancelled ? "border-red-200" : hasDelay ? "border-amber-200" : "border-[#E8E3DA]"}`}>
                    {/* Route + times */}
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                        <span className={`font-medium ${live.cancelled ? "line-through text-[#9A9A9A]" : "text-[#2F2F2F]"}`}>{leg.origin}</span>
                        <span className="rounded bg-[#EDE9E2] px-1.5 py-px text-[10px] font-medium text-[#7A7A7A] tracking-wide">{leg.originIata}</span>
                        <span className="mx-0.5 text-[#9AAE92]">→</span>
                        <span className={`font-medium ${live.cancelled ? "line-through text-[#9A9A9A]" : "text-[#2F2F2F]"}`}>{leg.destination}</span>
                        <span className="rounded bg-[#EDE9E2] px-1.5 py-px text-[10px] font-medium text-[#7A7A7A] tracking-wide">{leg.destIata}</span>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums space-y-0.5">
                        {(live.cancelled || hasDelay) ? (
                          <>
                            <div className="line-through text-[#9A9A9A]">
                              {fmtTime(leg.depTime)} → {fmtTime(leg.arrTime)}
                            </div>
                            {hasDelay && newDepTime && newArrTime && (
                              <div className="font-semibold text-amber-600">
                                {fmtTime(newDepTime)} → {fmtTime(newArrTime)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-[#6F6F6F]">
                            {fmtTime(leg.depTime)} → {fmtTime(leg.arrTime)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Delay / cancelled badge */}
                    {live.cancelled && (
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          {s.flightCancelled}
                        </span>
                      </div>
                    )}
                    {hasDelay && (
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {s.delayed} +{delayMin} min
                        </span>
                      </div>
                    )}
                    {/* Airline info row — shown for all legs */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {leg.deadhead ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                          {s.deadheadBadge}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#E8F5E0] px-2 py-0.5 text-[10px] font-medium text-[#3A7A1A]">
                          {s.pilotOperating}
                        </span>
                      )}
                      {(leg.carrierCode || leg.flightNumeric) && (
                        <div className="flex items-center gap-1.5">
                          {leg.carrierCode && (
                            <Image
                              src={`https://www.gstatic.com/flights/airline_logos/70px/${leg.carrierCode}.png`}
                              alt={leg.carrierDisplayName ?? leg.carrierCode}
                              width={20}
                              height={20}
                              className="rounded-sm"
                              unoptimized
                            />
                          )}
                          <span className="text-[11px] text-[#6F6F6F]">
                            {leg.carrierDisplayName ?? leg.carrierCode ?? ""}
                            {leg.flightNumeric && (
                              <a
                                href={flightAwareUrl(leg.carrierCode ?? "", leg.flightNumeric ?? "")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 font-medium text-[#3A7A1A] underline underline-offset-2 hover:text-[#2d6115]"
                              >
                                · Flight {leg.flightNumeric} ↗
                              </a>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Work Trip hero card */}
      {nextTrip && (
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-5 sm:p-6 shadow-lg space-y-4">
          {/* Header row */}
          {(() => {
            const tripDates = getTripDateStrings(nextTrip.event.start_time, nextTrip.event.end_time, baseTimezone);
            const todayDate = todayStr(baseTimezone);
            const dayIndex = tripDates.indexOf(todayDate);
            const progressLabel = dayIndex >= 0 ? `Day ${dayIndex + 1} of ${tripDates.length}` : null;
            return (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-[#2F2F2F] sm:text-2xl">{s.sectionCurrentTrip}</h2>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#6F6F6F]">
                      {localDayLabel(currentTripFirstDayStr ?? tripDates[0] ?? "", nextTrip.firstDayLabel)} → {localDayLabel(currentTripLastDayStr ?? tripDates[tripDates.length - 1] ?? "", nextTrip.lastDayLabel)}
                    </p>
                    {progressLabel && (
                      <span className="rounded-full bg-[#E6F1EA] px-2 py-0.5 text-[11px] font-medium text-[#3A7A1A]">
                        {progressLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="rounded-full bg-[#EDE9E2] px-3 py-1 text-sm font-medium text-[#4A6741]">
                    {totalDaysAway} {s.daysAway}
                  </span>
                  {totalDaysAway > daysAway && (
                    <span className="text-[10px] text-[#9A9A9A] pr-1">
                      {lang === "es" ? "incl. viajes anteriores" : lang === "de" ? "inkl. vorherige Trips" : "incl. prior trips"}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Decorative bar */}
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#E6F1EA] via-[#F1F6F3] to-[#DCE9E2]" />

          {/* Duty start time */}
          {/* Day-by-day breakdown */}
          {tripDayItems.length > 0 && (
            <div className="flex items-start gap-3 text-sm">
              <CalendarDays className="size-4 mt-0.5 shrink-0 text-[#9AAE92]" aria-hidden />
              <div className="space-y-1.5 w-full">
                {tripDayItems.map((day, dayIdx) => {
                  // Determine the true first/last duty dates from the trip's ISO timestamps,
                  // not from day.status — because commute inference can assign "Likely Commuting"
                  // to the same date as first duty when report time is ≥ 10 AM.
                  const firstDutyDateStr = formatInTimeZone(new Date(nextTrip.event.start_time), baseTimezone, "yyyy-MM-dd");
                  const lastDutyDateStr = formatInTimeZone(new Date(nextTrip.event.end_time), baseTimezone, "yyyy-MM-dd");
                  const isFirstDay = day.dateStr === firstDutyDateStr;
                  const isLastDay = day.status === "Expected Home" || day.dateStr === lastDutyDateStr;
                  const wonʼtComeHome = betweenTripStatus?.likelyComesHome === false && isLastDay;
                  // Commute days: "Likely Commuting" that is NOT on the first duty date
                  const seenTripDay = tripDayItems.slice(0, dayIdx).some(
                    (d) => d.status === "At Work" || d.status === "Overnight Away" || d.status === "Expected Home"
                      || d.dateStr === firstDutyDateStr
                  );
                  const isCommuteToWork = day.status === "Likely Commuting" && !seenTripDay && !isFirstDay;
                  const isCommuteHome = day.status === "Likely Commuting" && seenTripDay && !isFirstDay;
                  const isCommuteHomeCannotReturn = isCommuteHome && betweenTripStatus?.likelyComesHome === false;
                  const baseCityOverview = profile?.base_airport
                    ? iataToCityName((profile.base_airport ?? "").trim().toUpperCase())
                    : null;
                  const statusLabel = wonʼtComeHome || isCommuteHomeCannotReturn
                    ? s.tripEnds
                    : isCommuteToWork
                    ? s.headingToWork
                    : isCommuteHome
                    ? s.commutingHome
                    : isFirstDay
                    ? s.dutyStarts
                    : day.status === "Overnight Away"
                    ? s.overnight
                    : formatStatusForDisplay(day.status);
                  // Duty start time — shown inline on the first actual trip day
                  const startDate = new Date(nextTrip.event.start_time);
                  const dutyTime = formatInTimeZone(startDate, baseTimezone, timeFormat);
                  const dutyHour = parseInt(formatInTimeZone(startDate, baseTimezone, "H"), 10);
                  const tod = dutyHour < 12 ? s.inTheMorning : dutyHour < 18 ? s.inTheAfternoon : s.inTheEvening;
                  // Always show exact end time + end city for the last duty day (or commute-home-no-return)
                  const tripLegs = nextTrip.event.legs ?? [];
                  const lastLegDest = tripLegs.length > 0
                    ? iataToCityName((tripLegs[tripLegs.length - 1]!.destination ?? "").trim().toUpperCase())
                    : null;
                  const endTime = formatInTimeZone(new Date(nextTrip.event.end_time), baseTimezone, timeFormat);
                  const tripEndDetail = lastLegDest ? `${endTime} in ${lastLegDest}` : endTime;
                  const lastDayDetail = (isLastDay || isCommuteHomeCannotReturn)
                    ? tripEndDetail
                    : day.detail;
                  // Commute detail text (sub-line under the status label)
                  const commuteDetail = isCommuteToWork
                    ? (baseCityOverview ? `${s.travelingTo} ${baseCityOverview}` : null)
                    : isCommuteHome && !isCommuteHomeCannotReturn
                    ? s.timingDepends
                    : null;
                  return (
                  <div key={`${day.dateStr}-${dayIdx}`} className="space-y-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 whitespace-nowrap text-[#6F6F6F]">{localDayLabel(day.dateStr, day.dayLabel)}</span>
                      <span className="text-[#2F2F2F] font-medium">
                        {statusLabel}
                        {isFirstDay && (
                          <span className="ml-1 font-normal text-[#6F6F6F]">
                            {tod} {s.at} {dutyTime}
                          </span>
                        )}
                        {(isLastDay || isCommuteHomeCannotReturn) && !isFirstDay && lastDayDetail ? (
                          <span className="ml-1 font-normal text-[#6F6F6F]">{s.at} {lastDayDetail}</span>
                        ) : null}
                      </span>
                    </div>
                    {commuteDetail && (
                      <div className="pl-[7.5rem] text-xs text-[#6F6F6F]">
                        {commuteDetail}
                      </div>
                    )}
                    {day.todayFlightRoute && (
                      <div className="flex items-center gap-1.5 pl-[7.5rem] text-xs text-[#6F6F6F]">
                        <PlaneTakeoff className="size-3 shrink-0" aria-hidden />
                        {day.todayFlightRoute}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Home time — only show if pilot is expected to come home */}
          {nextTrip.expectedHomeTime && betweenTripStatus?.likelyComesHome !== false && (
            <div className="flex items-center gap-3 text-sm">
              <Home className="size-4 shrink-0 text-[#9AAE92]" aria-hidden />
              <span className="text-[#2F2F2F]">
                {s.home} {localDayLabel(currentTripLastDayStr ?? "", nextTrip.lastDayLabel)} {nextTrip.expectedHomeTime}
              </span>
            </div>
          )}

          {/* Between-trip warning — pilot won't make it home */}
          {betweenTripStatus?.likelyComesHome === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-amber-800">
                {s.nameWontMakeIt(firstName ?? "")}.
              </p>
              {betweenTripStatus.nextTripStartLabel && (
                <p className="text-xs text-amber-700">
                  {s.nextTripStarts} {localDayLabel(afterCurrentTripFirstDayStr ?? "", betweenTripStatus.nextTripStartLabel)}.{" "}
                  {betweenTripStatus.gapHours != null && (
                    <span>{s.only} {
                      betweenTripStatus.gapHours < 24
                        ? `${betweenTripStatus.gapHours} ${s.hoursGap}`
                        : betweenTripStatus.gapHours < 36
                        ? s.aboutADay
                        : betweenTripStatus.gapHours < 60
                        ? s.aboutXDays(Math.round(betweenTripStatus.gapHours / 24))
                        : `${Math.floor(betweenTripStatus.gapHours / 24)} ${s.daysBetweenTrips}`
                    }.</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 3: Remaining Week */}
      {(() => {
        const currentTripDates = nextTrip
          ? new Set(getTripDateStrings(nextTrip.event.start_time, nextTrip.event.end_time, baseTimezone))
          : new Set<string>();
        const remainingWeek = thisWeek.filter((day) => !currentTripDates.has(day.dateStr));
        if (remainingWeek.length === 0) return null;
        const pilotIsCommuter = isCommuter(profile);
        const baseCity = profile?.base_airport
          ? iataToCityName((profile.base_airport ?? "").trim().toUpperCase())
          : null;
        return (
      <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
          {s.sectionWeekAhead}
        </h2>
        <div className="space-y-2">
          {remainingWeek.map((day) => {
            const isCommuteDay = day.status === "Likely Commuting";
            const isFirstTripDay = day.tripDayLabel?.startsWith("Day 1 ");
            const isLastTripDay = day.status === "Expected Home";
            // Single-day home-base trip: departs from and returns to home airport
            const isDayTrip = isFirstTripDay && isLastTripDay && !!day.isHomeBaseTrip;
            const rawLabel = formatStatusForDisplay(day.status);
            const statusLabel =
              isDayTrip
                ? s.dayTrip
                : isCommuteDay
                ? s.headingToWork
                : isFirstTripDay
                ? s.dutyStarts
                : day.status === "Overnight Away"
                ? s.overnight
                : day.status === "Day Off"
                ? s.dayOff
                : isLastTripDay && day.isHomeBaseTrip
                ? s.comingHome
                : isLastTripDay && pilotIsCommuter
                ? s.commutingHome
                : rawLabel;
            const detailText =
              isCommuteDay
                ? (baseCity ? `${s.travelingTo} ${baseCity}` : day.detail)
                : isDayTrip || (isLastTripDay && day.isHomeBaseTrip)
                ? day.detail
                : isLastTripDay && !isFirstTripDay && pilotIsCommuter
                ? s.timingDepends
                : day.detail;
            return (
            <div
              key={day.dateStr}
              className="flex items-start justify-between gap-3 rounded-xl border border-[#E8E3DA] bg-white px-4 py-3"
            >
              <span className="shrink-0 text-[#6F6F6F] text-sm">{localDayLabel(day.dateStr, day.dayLabel)}</span>
              <div className="flex min-w-0 flex-col items-end gap-0.5">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="font-medium text-[#2F2F2F] text-sm">{statusLabel}</span>
                  {day.tripDayLabel && (() => {
                    const m = day.tripDayLabel.match(/Day (\d+) of (\d+)/);
                    const label = m ? `${s.day} ${m[1]} ${s.of} ${m[2]}` : day.tripDayLabel;
                    return (
                      <span className="rounded-full bg-[#EDE9E2] px-2 py-0.5 text-[10px] font-medium text-[#4A6741]">
                        {label}
                      </span>
                    );
                  })()}
                </div>
                {day.todayFlightRoute && (
                  <span className="text-right text-[#6F6F6F] text-xs">{day.todayFlightRoute}</span>
                )}
                {detailText && (
                  <span className="text-right text-[#6F6F6F] text-xs">{detailText}</span>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </section>
        );
      })()}

      {/* Section 4: Upcoming — every day in order, no gaps */}
      {(() => {
        const currentTripDatesUpcoming = nextTrip
          ? new Set(getTripDateStrings(nextTrip.event.start_time, nextTrip.event.end_time, baseTimezone))
          : new Set<string>();
        const upcoming = upcomingAll.filter((day) => !currentTripDatesUpcoming.has(day.dateStr));
        const pilotIsCommuterUpcoming = isCommuter(profile);
        const baseCityUpcoming = profile?.base_airport
          ? iataToCityName((profile.base_airport ?? "").trim().toUpperCase())
          : null;
        return (
        <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
            {s.sectionUpcoming}
          </h2>
          {upcoming.length > 0 ? (
            <div className="space-y-1.5">
              {upcoming.map((item) => {
                const isDayOff = item.status === "Day Off";
                const isCommuteDay = item.status === "Likely Commuting";
                const isFirstTripDay = item.tripDayLabel?.startsWith("Day 1 ");
                const isLastTripDay = item.status === "Expected Home";
                const isDayTrip = isFirstTripDay && isLastTripDay && !!item.isHomeBaseTrip;
                const rawLabel = formatStatusForDisplay(item.status);
                const statusLabel =
                  isDayTrip
                    ? s.dayTrip
                    : isCommuteDay
                    ? s.headingToWork
                    : isFirstTripDay
                    ? s.dutyStarts
                    : item.status === "Overnight Away"
                    ? s.overnight
                    : item.status === "Day Off"
                    ? s.dayOff
                    : isLastTripDay && item.isHomeBaseTrip
                    ? s.comingHome
                    : isLastTripDay && pilotIsCommuterUpcoming
                    ? s.commutingHome
                    : rawLabel;
                const detailText =
                  isCommuteDay
                    ? (baseCityUpcoming ? `${s.travelingTo} ${baseCityUpcoming}` : item.detail)
                    : isDayTrip || (isLastTripDay && item.isHomeBaseTrip)
                    ? item.detail
                    : isLastTripDay && !isFirstTripDay && pilotIsCommuterUpcoming
                    ? s.timingDepends
                    : item.detail;
                return (
                <div
                  key={item.dateStr}
                  className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-2.5 ${
                    isDayOff
                      ? "border-[#EEEBE4] bg-[#FAF9F6]"
                      : "border-[#E8E3DA] bg-white"
                  }`}
                >
                  <span className={`shrink-0 text-sm ${isDayOff ? "text-[#ABABAB]" : "text-[#6F6F6F]"}`}>
                    {localDayLabel(item.dateStr, item.dayLabel)}
                  </span>
                  <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className={`text-sm ${isDayOff ? "font-normal text-[#ABABAB]" : "font-medium text-[#2F2F2F]"}`}>
                        {statusLabel}
                      </span>
                      {item.tripDayLabel && (() => {
                        const m = item.tripDayLabel.match(/Day (\d+) of (\d+)/);
                        const label = m ? `${s.day} ${m[1]} ${s.of} ${m[2]}` : item.tripDayLabel;
                        return (
                          <span className="rounded-full bg-[#EDE9E2] px-2 py-0.5 text-[10px] font-medium text-[#4A6741]">
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    {!isDayOff && item.todayFlightRoute && (
                      <span className="text-right text-[#6F6F6F] text-xs">{item.todayFlightRoute}</span>
                    )}
                    {!isDayOff && detailText && (
                      <span className="text-right text-[#6F6F6F] text-xs">{detailText}</span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-[#E8E3DA] bg-[#FFFFFF] px-4 py-3 text-[#6F6F6F] text-sm">
              {s.nothingScheduled}
            </p>
          )}
        </section>
        );
      })()}
      </>
      )}
    </div>
    </div>
    </div>
    </FamilyViewPhoneFrame>
  );
}
