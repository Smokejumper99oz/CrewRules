"use client";

import type { ProTrialUsers, ProTrialUserRow } from "@/lib/super-admin/actions";
import { ChevronDown, ChevronRight, AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

type SuperAdminTrialUsersProps = {
  trialUsers: ProTrialUsers;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50";

function formatRow(row: ProTrialUserRow): { primary: string; secondary: string; status: string } {
  const primary = row.full_name?.trim() || row.email || row.id.slice(0, 8);
  const parts: string[] = [];
  if (row.full_name?.trim() && row.email) parts.push(row.email);
  parts.push(row.tenant);
  const secondary = parts.join(" · ");
  let status = "";
  if (row.status === "expiring_urgent" && row.daysRemaining != null) {
    status = row.daysRemaining === 1 ? "1 day left" : `${row.daysRemaining} days left`;
  } else if (row.status === "expiring_soon" && row.daysRemaining != null) {
    status = row.daysRemaining === 1 ? "1 day left" : `${row.daysRemaining} days left`;
  } else if (row.status === "expired") {
    status = "Expired";
  } else if (row.status === "converted") {
    status = "Converted";
  }
  return { primary, secondary, status };
}

function UserRow({ row }: { row: ProTrialUserRow }) {
  const { primary, secondary, status } = formatRow(row);
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-slate-700/30 text-sm">
      <div className="min-w-0 flex-1">
        <span className="text-slate-200 truncate block">{primary}</span>
        {secondary && (
          <span className="text-slate-500 text-xs truncate block">{secondary}</span>
        )}
      </div>
      <span className="text-slate-400 text-xs shrink-0">{status}</span>
    </div>
  );
}

function GroupSection({
  title,
  icon,
  rows,
  emptyLabel = "None",
}: {
  title: string;
  icon: React.ReactNode;
  rows: ProTrialUserRow[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
        {icon}
        {title}
      </div>
      <ul className="space-y-0">
        {rows.map((row) => (
          <li key={row.id}>
            <UserRow row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SuperAdminTrialUsers({ trialUsers }: SuperAdminTrialUsersProps) {
  const hasActionable =
    trialUsers.expiringUrgent.length > 0 ||
    trialUsers.expiringSoon.length > 0 ||
    trialUsers.expired.length > 0 ||
    trialUsers.converted.length > 0;

  const [isOpen, setIsOpen] = useState(hasActionable);
  const totalCount =
    trialUsers.expiringUrgent.length +
    trialUsers.expiringSoon.length +
    trialUsers.expired.length +
    trialUsers.converted.length;

  if (!hasActionable) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 w-full text-left py-2 text-sm text-slate-400 hover:text-slate-300"
        >
          <ChevronRight className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          Trial users
          <span className="text-slate-500">(none)</span>
        </button>
        {isOpen && (
          <div className="pl-6 py-2 text-sm text-slate-500">No trial-related users to show.</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left py-2 text-sm text-slate-300 hover:text-slate-200 font-medium"
      >
        <ChevronDown className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        Trial users
        <span className="text-slate-500 font-normal">({totalCount})</span>
      </button>
      {isOpen && (
        <div className={`${cardBase} p-4 mt-2 space-y-4`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GroupSection
            title="Expiring in 3 days"
            icon={<AlertTriangle className="size-3.5 text-amber-400" />}
            rows={trialUsers.expiringUrgent}
          />
          <GroupSection
            title="Expiring in 7 days"
            icon={<Clock className="size-3.5" />}
            rows={trialUsers.expiringSoon}
          />
          <GroupSection
            title="Trial expired"
            icon={<XCircle className="size-3.5" />}
            rows={trialUsers.expired}
          />
          <GroupSection
            title="Recently converted"
            icon={<CheckCircle className="size-3.5 text-[#75C043]" />}
            rows={trialUsers.converted}
          />
        </div>
        </div>
      )}
    </div>
  );
}
