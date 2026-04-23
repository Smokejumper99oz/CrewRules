import { addDays } from "date-fns";
import { getProfile } from "@/lib/profile";
import {
  getScheduleEvents,
  getScheduleDisplaySettings,
  getTrainingCityForEvent,
  getLastEndedDutyTouchingToday,
} from "@/app/frontier/pilots/portal/schedule/actions";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import { FamilyViewScheduleContent } from "@/components/family-view-schedule-content";
import { mergeFamilyViewScheduleEvents } from "@/lib/family-view/merge-family-view-events";

export default async function FamilyViewPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; lang?: string }>;
}) {
  const [profile, displaySettings] = await Promise.all([getProfile(), getScheduleDisplaySettings()]);
  const baseTz = displaySettings.baseTimezone ?? "America/Denver";
  const now = new Date();
  const fromIso = now.toISOString();
  const toIso = addDays(now, 35).toISOString();
  const [{ events: forwardEvents }, lastEndedToday] = await Promise.all([
    getScheduleEvents(fromIso, toIso),
    getLastEndedDutyTouchingToday(baseTz),
  ]);
  const events = mergeFamilyViewScheduleEvents(forwardEvents, lastEndedToday);

  return (
    <FamilyViewScheduleContent
      profile={profile}
      displaySettings={displaySettings}
      events={events}
      searchParams={searchParams}
      pathPrefix=""
      showSharingDisabledCallout
      fetchTrainingCity={getTrainingCityForEvent}
      fetchCommuteFlights={(p) => getCommuteFlights(p)}
    />
  );
}
