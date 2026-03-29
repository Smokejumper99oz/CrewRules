import type { RecentActivityData, RecentImport } from "@/lib/super-admin/actions";
import { formatDisplayName } from "@/lib/format-display-name";
import { SuperAdminUserWithMailto } from "./super-admin-user-mailto";
import { PlaceholderCard } from "./placeholder-card";
import { format, formatDistanceToNow } from "date-fns";
import { UserPlus, Calendar, AlertCircle, CreditCard } from "lucide-react";

type SuperAdminRecentActivityProps = {
  data: RecentActivityData;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4";

const RECENT_IMPORT_SOURCE_LABEL = "FLICA";

function RecentImportRow({ imp }: { imp: RecentImport }) {
  // Show when the import ran; `earliest_start_time` is kept on `imp` for future detail views only.
  const dt = format(new Date(imp.imported_at), "MMMM d HH:mm");
  const batchPrefix = (imp.import_batch_id ?? imp.user_id).replace(/-/g, "").slice(0, 8);

  return (
    <li className="min-w-0 py-0.5">
      <div
        className="grid min-w-0 grid-cols-[7.5rem_5.5rem_minmax(0,1fr)_auto] items-center gap-x-3 text-sm leading-tight"
      >
        <time
          className="whitespace-nowrap tabular-nums font-semibold tracking-tight text-slate-100"
          dateTime={imp.imported_at}
        >
          {dt}
        </time>
        <span className="whitespace-nowrap tabular-nums text-right font-medium text-slate-200">
          {imp.count} events
        </span>
        <SuperAdminUserWithMailto
          rootClassName="w-full"
          fullName={imp.user_full_name}
          email={imp.user_email}
          nameClassName="font-normal text-slate-300"
        />
        <span className="justify-self-end whitespace-nowrap text-right font-normal text-slate-500">
          {RECENT_IMPORT_SOURCE_LABEL}
          <span className="text-slate-500/40"> · </span>
          <span className="font-mono text-[11px] text-slate-500">{batchPrefix}…</span>
        </span>
      </div>
    </li>
  );
}

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
          <ul className="sidebar-scrollbar-hide space-y-2 max-h-40 overflow-y-auto">
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
          <ul className="sidebar-scrollbar-hide max-h-40 space-y-2 overflow-y-auto">
            {data.recentImports.length === 0 ? (
              <li className="text-sm text-slate-500">No recent imports</li>
            ) : (
              data.recentImports.map((imp) => (
                <RecentImportRow key={`${imp.user_id}-${imp.imported_at}`} imp={imp} />
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
