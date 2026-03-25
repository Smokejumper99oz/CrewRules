import type { RecentActivityData } from "@/lib/super-admin/actions";
import { formatDisplayName } from "@/lib/format-display-name";
import { PlaceholderCard } from "./placeholder-card";
import { formatDistanceToNow } from "date-fns";
import { UserPlus, Calendar, AlertCircle, CreditCard } from "lucide-react";

type SuperAdminRecentActivityProps = {
  data: RecentActivityData;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4";

export function SuperAdminRecentActivity({ data }: SuperAdminRecentActivityProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200">Recent Activity</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <UserPlus className="size-4" />
            Recent signups
          </div>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {data.recentSignups.length === 0 ? (
              <li className="text-sm text-slate-500">No recent signups</li>
            ) : (
              data.recentSignups.map((s) => (
                <li key={s.id} className="text-sm flex justify-between gap-2">
                  <span className="text-slate-300 truncate">
                    {formatDisplayName(s.full_name || s.email || s.id.slice(0, 8))}
                  </span>
                  <span className="text-slate-500 shrink-0 text-xs">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <Calendar className="size-4" />
            Recent imports
          </div>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {data.recentImports.length === 0 ? (
              <li className="text-sm text-slate-500">No recent imports</li>
            ) : (
              data.recentImports.map((imp, i) => (
                <li key={i} className="text-sm flex justify-between gap-2">
                  <span className="text-slate-300 truncate">
                    {imp.count} events · {imp.user_id.slice(0, 8)}…
                  </span>
                  <span className="text-slate-500 shrink-0 text-xs">
                    {formatDistanceToNow(new Date(imp.imported_at), { addSuffix: true })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <PlaceholderCard
          title="Recent errors"
          subtitle="Not yet wired"
          icon={<AlertCircle className="size-3" />}
          variant="chip"
        />
        <PlaceholderCard
          title="Upgrades / billing"
          subtitle="Not yet wired"
          icon={<CreditCard className="size-3" />}
          variant="chip"
        />
      </div>
    </div>
  );
}
