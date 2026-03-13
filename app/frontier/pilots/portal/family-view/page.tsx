import Link from "next/link";
import { FamilyViewPhoneFrame } from "@/components/family-view-phone-frame";
import {
  CalendarDays,
  PlaneTakeoff,
  MapPin,
  Clock,
  Moon,
  Home,
  User,
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
  formatStatusForDisplay,
} from "@/lib/family-view/translate-schedule";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { getTripDateStrings, todayStr } from "@/lib/leg-dates";

const iconClass = "size-4 shrink-0 text-[#7A7A7A]";
const nextTripIconClass = "size-4 shrink-0 text-[#7A7A7A]";

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

  const tripDates = nextTrip
    ? getTripDateStrings(nextTrip.event.start_time, nextTrip.event.end_time, baseTimezone)
    : [];
  const daysAway =
    nextTrip && tripDates.length > 0
      ? differenceInCalendarDays(parseISO(tripDates[0]), parseISO(todayStr(baseTimezone)))
      : 0;
  const nightsCount = tripDates.length - 1;

  return (
    <FamilyViewPhoneFrame>
    <div className="max-w-full lg:max-w-[1200px] xl:max-w-[1320px] lg:mx-auto">
    <div className="rounded-[28px] lg:rounded-2xl bg-[#F7F6F2] p-5 sm:p-8 lg:p-8 xl:p-10 shadow-sm">
      <div className="space-y-8">
      {/* Disabled state when Family View is off */}
      {!isEnabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 shadow-sm">
          <p className="font-medium text-amber-800">Family View is not enabled yet.</p>
          <p className="mt-1 text-sm text-[#2F2F2F]">
            Turn it on in{" "}
            <Link href="/frontier/pilots/portal/profile#family-view-sharing" className="text-[#7FB069] hover:underline">
              Profile → Family View Sharing
            </Link>{" "}
            to start sharing your schedule with family.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 rounded-xl bg-[#F4F1EA] p-4">
        <h1 className="text-xl font-medium tracking-tight">
          <span className="text-[#2F4F46]">Crew</span><span className="text-[#7FB069]">Rules</span><sup className="text-[#2F4F46]">™</sup>{" "}
          <span className="text-[#2F2F2F]">Family View</span>
        </h1>
        <div className="flex items-center gap-2 rounded-full border border-[#DDD6CC] bg-[#EDE9E2] px-4 py-2 text-sm font-medium text-[#2F2F2F]">
          <User className="size-4 shrink-0 text-[#7A7A7A]" aria-hidden />
          <span>Profile</span>
        </div>
      </div>

      <div className="h-6 rounded-xl border border-[#E8E3DA] bg-[#F4F1EA] mb-6" aria-hidden />

      {/* Section 1: Today */}
      <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
          Today
        </h2>
        <div className="rounded-xl border border-[#E8E3DA] bg-white px-4 py-3">
          <span className="text-lg font-medium text-[#2F2F2F]">{formatStatusForDisplay(todayStatus.status)}</span>
          {todayStatus.detail && (
            <span className="ml-2 text-[#6F6F6F] text-sm">{todayStatus.detail}</span>
          )}
        </div>
      </section>

      {/* Work Trip hero card */}
      {nextTrip && (
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-5 sm:p-6 shadow-lg">
          <h2 className="text-2xl font-semibold text-[#2F2F2F]">Work Trip</h2>
          <p className="mt-2 text-base text-[#6F6F6F]">
            {nextTrip.firstDayLabel} → {nextTrip.lastDayLabel}
          </p>
          <div
            className="h-12 w-full rounded-lg bg-gradient-to-r from-[#E6F1EA] via-[#F1F6F3] to-[#DCE9E2] mt-4 mb-4"
          />
          <div className="mt-2 divide-y divide-[#E8E3DA] text-base text-[#2F2F2F]">
            <p className="flex items-center gap-4 py-4">
              <CalendarDays className="size-5 shrink-0 text-[#9AAE92]" aria-hidden />
              {daysAway} days away
            </p>
            {nextTrip.overnightCities.length === 1 && nightsCount > 0 && (
              <p className="flex items-center gap-4 py-4">
                <Moon className="size-5 shrink-0 text-[#9AAE92]" aria-hidden />
                {nightsCount} nights in {nextTrip.overnightCities[0]}
              </p>
            )}
            {nextTrip.overnightCities.length > 1 && (
              <p className="flex items-center gap-4 py-4">
                <Moon className="size-5 shrink-0 text-[#9AAE92]" aria-hidden />
                Overnights in {nextTrip.overnightCities.join(", ")}
              </p>
            )}
            {nextTrip.expectedHomeTime && (
              <p className="flex items-center gap-4 py-4">
                <Home className="size-5 shrink-0 text-[#9AAE92]" aria-hidden />
                Home {nextTrip.lastDayLabel} {nextTrip.expectedHomeTime}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Trip Details */}
      <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/60 p-4 sm:p-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#6F6F6F] mb-2">
          Trip Details
        </h2>
        {nextTrip ? (
          <div className="space-y-3 rounded-xl border border-[#E8E3DA] bg-white/80 p-4">
            {/* Work Trip header */}
            <p className="flex items-center gap-2 text-[#2F2F2F] text-sm">
              <PlaneTakeoff className={nextTripIconClass} aria-hidden />
              <span>
                <span className="font-medium">Work trip</span>
                <span className="text-[#6F6F6F]"> {nextTrip.firstDayLabel} – {nextTrip.lastDayLabel}</span>
              </span>
            </p>

            {/* COMMUTE box */}
            {nextTrip.commuteInfo && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-3">
                <p className="flex items-center gap-2 text-amber-800 text-sm">
                  <MapPin className={nextTripIconClass} aria-hidden />
                  <span>
                    <span className="font-medium">{nextTrip.commuteInfo.commuteDayLabel}:</span>{" "}
                    {nextTrip.commuteInfo.note}
                  </span>
                </p>
              </div>
            )}

            {/* TRIP DETAILS */}
            <div className="space-y-3 pt-1">
              {nextTrip.reportTimeDisplay && (
                <div className="text-[#6F6F6F] text-sm">
                  <p className="flex items-center gap-2">
                    <Clock className={nextTripIconClass} aria-hidden />
                    <span>Trip begins {nextTrip.reportTimeDisplay.base}</span>
                  </p>
                  {nextTrip.reportTimeDisplay.home && (
                    <p className="ml-6 text-[#6F6F6F] text-sm">
                      {nextTrip.reportTimeDisplay.home} {nextTrip.reportTimeDisplay.homeLabel ?? "home"} time
                    </p>
                  )}
                </div>
              )}
              {nextTrip.overnightCities.length > 0 && (
                <p className="flex items-center gap-2 text-[#6F6F6F] text-sm">
                  <Moon className={nextTripIconClass} aria-hidden />
                  <span className="break-words">
                    {nextTrip.overnightCities.length === 1
                      ? `Overnight in ${nextTrip.overnightCities[0]}`
                      : `Overnights in ${nextTrip.overnightCities.join(", ")}`}
                  </span>
                </p>
              )}
              {nextTrip.expectedHomeTime && (
                <p className="flex items-center gap-2 text-[#6F6F6F] text-sm">
                  <Home className={nextTripIconClass} aria-hidden />
                  <span>Home {nextTrip.lastDayLabel} {nextTrip.expectedHomeTime}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-[#E8E3DA] bg-white/60 px-4 py-3 text-[#6F6F6F] text-sm">
            No trips coming up
          </p>
        )}
      </section>

      {/* Section 3: This Week */}
      <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
          This Week
        </h2>
        <div className="space-y-2">
          {thisWeek.map((day) => (
            <div
              key={day.dateStr}
              className="flex items-center justify-between rounded-xl border border-[#E8E3DA] bg-white px-4 py-3"
            >
              <span className="text-[#6F6F6F] text-sm">{day.dayLabel}</span>
              <div className="text-right">
                <span className="font-medium text-[#2F2F2F] text-sm">{formatStatusForDisplay(day.status)}</span>
                {day.detail && (
                  <span className="ml-1.5 text-[#6F6F6F] text-sm">{day.detail}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Upcoming */}
      <section className="rounded-2xl border border-[#E8E3DA] bg-[#F4F1EA]/50 p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6F6F6F] mb-3">
          Upcoming
        </h2>
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((item) => (
              <div
                key={item.dateStr}
                className="flex items-center justify-between rounded-xl border border-[#E8E3DA] bg-white px-4 py-3"
              >
                <span className="text-[#6F6F6F] text-sm">{item.dayLabel}</span>
                <div className="text-right">
                  <span className="font-medium text-[#2F2F2F] text-sm">{formatStatusForDisplay(item.status)}</span>
                  {item.detail && (
                    <span className="ml-1.5 text-[#6F6F6F] text-sm">{item.detail}</span>
                  )}
                  {item.reportTime && (
                    <span className="ml-1.5 text-[#6F6F6F] text-sm">
                      Starts {formatReportTimeForDisplay(item.reportTime, settings)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-[#E8E3DA] bg-[#FFFFFF] px-4 py-3 text-[#6F6F6F] text-sm">
            Nothing scheduled
          </p>
        )}
      </section>
    </div>
    </div>
    </div>
    </FamilyViewPhoneFrame>
  );
}
