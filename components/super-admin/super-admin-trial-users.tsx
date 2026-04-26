"use client";

import type { ProTrialUsers, ProTrialUserRow } from "@/lib/super-admin/actions";
import { formatDisplayName } from "@/lib/format-display-name";
import { ChevronDown, ChevronRight, AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

type SuperAdminTrialUsersProps = {
  trialUsers: ProTrialUsers;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50";

const TRIAL_USERS_PAGE_SIZE = 5;
/** One list row slot (name + meta + padding); list always shows this many slots so the card height does not jump between pages. */
const TRIAL_USER_ROW_SLOT_CLASS = "min-h-[3.25rem]";
/** Reserved strip under the list so columns align when only some groups paginate. */
const TRIAL_USERS_PAGER_STRIP_MIN = "min-h-[2.75rem]";

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
        <span className="text-slate-200 truncate block">{formatDisplayName(primary)}</span>
        {secondary && (
          <span className="text-slate-500 text-xs truncate block">{secondary}</span>
        )}
      </div>
      <span className="text-slate-400 text-xs shrink-0">{status}</span>
    </div>
  );
}

function PaginatedGroupSection({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: ProTrialUserRow[];
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / TRIAL_USERS_PAGE_SIZE));

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(rows.length / TRIAL_USERS_PAGE_SIZE));
    setPage((p) => Math.min(Math.max(1, p), tp));
  }, [rows.length]);

  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = rows.slice(
    (safePage - 1) * TRIAL_USERS_PAGE_SIZE,
    safePage * TRIAL_USERS_PAGE_SIZE
  );

  if (rows.length === 0) return null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-400">
        {icon}
        {title}
        <span className="font-normal text-slate-500">({rows.length})</span>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0">
        {Array.from({ length: TRIAL_USERS_PAGE_SIZE }, (_, i) => {
          const row = slice[i];
          if (row) {
            return (
              <li key={row.id} className={`${TRIAL_USER_ROW_SLOT_CLASS} shrink-0`}>
                <UserRow row={row} />
              </li>
            );
          }
          return (
            <li
              key={`trial-slot-${title}-${i}`}
              aria-hidden
              className={`${TRIAL_USER_ROW_SLOT_CLASS} shrink-0`}
            />
          );
        })}
      </ul>
      <div
        className={`${TRIAL_USERS_PAGER_STRIP_MIN} mt-auto flex shrink-0 flex-col justify-center border-t pt-2 text-[11px] text-slate-500 ${
          totalPages > 1 ? "border-slate-700/50" : "border-transparent"
        }`}
      >
        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded px-2 py-0.5 font-medium text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200 disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded px-2 py-0.5 font-medium text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
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
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PaginatedGroupSection
            title="Expiring in 3 days"
            icon={<AlertTriangle className="size-3.5 text-amber-400" />}
            rows={trialUsers.expiringUrgent}
          />
          <PaginatedGroupSection
            title="Expiring in 7 days"
            icon={<Clock className="size-3.5" />}
            rows={trialUsers.expiringSoon}
          />
          <PaginatedGroupSection
            title="Trial expired"
            icon={<XCircle className="size-3.5" />}
            rows={trialUsers.expired}
          />
          <PaginatedGroupSection
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
