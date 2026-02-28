import Link from "next/link";
import { getUpcomingEvents, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleEventCard } from "@/components/schedule-event-card";

export async function PortalScheduleUpcoming({ tenant, portal }: { tenant: string; portal: string }) {
  const [{ events }, displaySettings, profile] = await Promise.all([
    getUpcomingEvents(3),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);
  const scheduleHref = `/${tenant}/${portal}/portal/schedule`;

  if (events.length === 0) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming</h2>
        <Link href={scheduleHref} className="text-sm font-medium text-[#75C043] hover:underline">
          View full schedule →
        </Link>
      </div>
      <ul className="mt-4 space-y-2">
        {events.map((ev) => (
          <li key={ev.id}>
            <ScheduleEventCard event={ev} displaySettings={displaySettings} position={profile?.position ?? null} compact />
          </li>
        ))}
      </ul>
    </div>
  );
}
