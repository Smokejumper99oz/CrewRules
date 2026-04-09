import { addDays } from "date-fns";
import { getProfile } from "@/lib/profile";
import {
  getScheduleEvents,
  getScheduleDisplaySettings,
  getTrainingCityForEvent,
} from "@/app/frontier/pilots/portal/schedule/actions";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import { FamilyViewScheduleContent } from "@/components/family-view-schedule-content";

export default async function FamilyViewPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; lang?: string }>;
}) {
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
