import { getAvailableMonths, getMonthStats } from "@/app/frontier/pilots/portal/schedule/actions";
import type { MonthStats } from "@/app/frontier/pilots/portal/schedule/actions";
import { PortalMonthStatsClient } from "./portal-month-stats";
import type { Profile } from "@/lib/profile";

function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export async function PortalMonthStats({
  tenant,
  portal,
  profile,
}: {
  tenant: string;
  portal: string;
  profile: Profile | null;
}) {
  const availableMonths = await getAvailableMonths();
  if (availableMonths.length === 0) return null;

  const statsByMonth: Record<string, MonthStats> = {};
  for (const m of availableMonths) {
    const stats = await getMonthStats(m.year, m.month);
    statsByMonth[monthKey(m.year, m.month)] = stats;
  }

  return (
    <PortalMonthStatsClient
      tenant={tenant}
      portal={portal}
      profile={profile}
      availableMonths={availableMonths}
      statsByMonth={statsByMonth}
    />
  );
}
