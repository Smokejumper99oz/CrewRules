import { getNextDuty, getUpcomingEvents, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleEventCard } from "@/components/schedule-event-card";

export async function PortalScheduleUpcoming({ tenant, portal }: { tenant: string; portal: string }) {
  const [nextDuty, { events: rawEvents }, displaySettings, profile] = await Promise.all([
    getNextDuty(),
    getUpcomingEvents(7),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);
  const excludeId = nextDuty.event?.id;
  const upcomingEvents = excludeId
    ? rawEvents.filter((e) => e.id !== excludeId).slice(0, 5)
    : rawEvents.slice(0, 5);

  if (upcomingEvents.length === 0) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
      <div className="border-b border-white/5 pb-2">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming</h2>
      </div>
      <ul className="mt-4 space-y-2">
        {upcomingEvents.map((ev, i) => (
          <li key={ev.id} className={i === 4 ? "xl:hidden" : undefined}>
            <ScheduleEventCard event={ev} displaySettings={displaySettings} position={profile?.position ?? null} compact />
          </li>
        ))}
      </ul>
    </div>
  );
}
