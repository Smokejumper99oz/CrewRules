import type { ProductUsageData } from "@/lib/super-admin/actions";
import { PlaceholderCard } from "./placeholder-card";
import { Calendar, Search, Car, Users } from "lucide-react";

type SuperAdminProductUsageProps = {
  data: ProductUsageData;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4";

export function SuperAdminProductUsage({ data }: SuperAdminProductUsageProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200">Product Usage</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.scheduleImportsLast30d !== null ? (
          <div className={cardBase}>
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Calendar className="size-3.5" />
              Schedule imports (30d)
            </div>
            <div className="text-2xl font-semibold text-slate-200">{data.scheduleImportsLast30d}</div>
          </div>
        ) : (
          <PlaceholderCard
            title="Schedule imports"
            subtitle="Data unavailable"
            icon={<Calendar className="size-4" />}
            variant="compact"
          />
        )}

        {data.aiSearchLast30d !== null ? (
          <div className={cardBase}>
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Search className="size-3.5" />
              AI / contract search (30d)
            </div>
            <div className="text-2xl font-semibold text-slate-200">{data.aiSearchLast30d}</div>
          </div>
        ) : (
          <PlaceholderCard
            title="AI / contract search"
            subtitle="Data unavailable"
            icon={<Search className="size-4" />}
            variant="compact"
          />
        )}

        {data.commuteRefreshTotal !== null ? (
          <div className={cardBase}>
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Car className="size-3.5" />
              Commute Assist refreshes
            </div>
            <div className="text-2xl font-semibold text-slate-200">{data.commuteRefreshTotal}</div>
          </div>
        ) : (
          <PlaceholderCard
            title="Commute Assist usage"
            subtitle="Data unavailable"
            icon={<Car className="size-4" />}
            variant="compact"
          />
        )}

        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Users className="size-3.5" />
            Family View enabled
          </div>
          <div className="text-2xl font-semibold text-slate-200">{data.familyViewEnabledCount}</div>
        </div>
      </div>
    </div>
  );
}
