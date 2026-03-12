import Link from "next/link";
import {
  PlaneTakeoff,
  MapPin,
  Clock,
  Moon,
  Home,
} from "lucide-react";
import { getProfile } from "@/lib/profile";
import { getScheduleEvents, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import {
  getTodayStatus,
  getNextTripSummary,
  getThisWeekDays,
  getUpcomingBlocks,
  getFamilyViewSettings,
  formatReportTimeForDisplay,
} from "@/lib/family-view/translate-schedule";
import { addDays } from "date-fns";

const iconClass = "size-4 shrink-0 text-slate-500";

export default async function FamilyViewPage() {
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
  const upcoming = getUpcomingBlocks(events, profile, baseTimezone, settings, 5);

  const isEnabled = profile?.family_view_enabled ?? false;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Crew<span className="text-[#75C043]">Rules</span>
          <span className="align-super text-xs">™</span> Family View
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Preview of what shared family schedule will look like
        </p>
      </div>

      {/* Disabled state when Family View is off */}
      {!isEnabled && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="font-medium text-amber-200/90">Family View is currently turned off.</p>
          <p className="mt-1 text-sm text-slate-400">
            Enable it in{" "}
            <Link href="/frontier/pilots/portal/profile" className="text-[#75C043] hover:underline">
              Profile → Family View Sharing
            </Link>{" "}
            to prepare it for sharing.
          </p>
        </div>
      )}

      {/* Section 1: Today */}
      <section className="rounded-2xl border border-emerald-500/30 bg-slate-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Today
        </h2>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
          <span className="text-lg font-medium text-white">{todayStatus.status}</span>
          {todayStatus.detail && (
            <span className="ml-2 text-slate-400">{todayStatus.detail}</span>
          )}
        </div>
      </section>

      {/* Section 2: Next Trip */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Next Trip
        </h2>
        {nextTrip ? (
          <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
            {/* Work Trip header */}
            <p className="flex items-center gap-2 text-white">
              <PlaneTakeoff className={iconClass} aria-hidden />
              <span>
                <span className="font-medium">Work trip</span>
                <span className="text-slate-400"> {nextTrip.firstDayLabel} – {nextTrip.lastDayLabel}</span>
              </span>
            </p>

            {/* COMMUTE box */}
            {nextTrip.commuteInfo && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <p className="flex items-center gap-2 text-amber-400/90 text-sm">
                  <MapPin className={iconClass} aria-hidden />
                  <span>
                    <span className="font-medium">{nextTrip.commuteInfo.commuteDayLabel}:</span>{" "}
                    {nextTrip.commuteInfo.note}
                  </span>
                </p>
              </div>
            )}

            {/* TRIP DETAILS */}
            <div className="space-y-2 pt-1">
              {nextTrip.reportTimeDisplay && (
                <div className="text-slate-300 text-sm">
                  <p className="flex items-center gap-2">
                    <Clock className={iconClass} aria-hidden />
                    <span>Starts {nextTrip.reportTimeDisplay.base}</span>
                  </p>
                  {nextTrip.reportTimeDisplay.home && (
                    <p className="ml-6 text-slate-400 text-xs">
                      {nextTrip.reportTimeDisplay.home} {nextTrip.reportTimeDisplay.homeLabel ?? "home"} time
                    </p>
                  )}
                </div>
              )}
              {nextTrip.overnightCities.length > 0 && (
                <p className="flex items-center gap-2 text-slate-300 text-sm">
                  <Moon className={iconClass} aria-hidden />
                  <span>Staying in {nextTrip.overnightCities.join(", ")}</span>
                </p>
              )}
              {nextTrip.expectedHomeTime && (
                <p className="flex items-center gap-2 text-slate-300 text-sm">
                  <Home className={iconClass} aria-hidden />
                  <span>Expected home {nextTrip.lastDayLabel} {nextTrip.expectedHomeTime}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-slate-400 text-sm">
            No trips coming up
          </p>
        )}
      </section>

      {/* Section 3: This Week */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          This Week
        </h2>
        <div className="space-y-2">
          {thisWeek.map((day) => (
            <div
              key={day.dateStr}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-2.5"
            >
              <span className="text-slate-400 text-sm">{day.dayLabel}</span>
              <div className="text-right">
                <span className="font-medium text-white">{day.status}</span>
                {day.detail && (
                  <span className="ml-1.5 text-slate-400 text-sm">{day.detail}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Upcoming */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Upcoming
        </h2>
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((item) => (
              <div
                key={item.dateStr}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-2.5"
              >
                <span className="text-slate-400 text-sm">{item.dayLabel}</span>
                <div className="text-right">
                  <span className="font-medium text-white">{item.status}</span>
                  {item.detail && (
                    <span className="ml-1.5 text-slate-400 text-sm">{item.detail}</span>
                  )}
                  {item.reportTime && (
                    <span className="ml-1.5 text-slate-400 text-sm">
                      Starts {formatReportTimeForDisplay(item.reportTime, settings)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-slate-400 text-sm">
            Nothing scheduled
          </p>
        )}
      </section>
    </div>
  );
}
