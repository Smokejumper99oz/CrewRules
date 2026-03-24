"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { format } from "date-fns";
import type { WaitlistEntryRow } from "@/lib/waitlist/fetch-waitlist-entries";
import { WaitlistStatusSelect } from "./waitlist-status-select";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "launched", label: "Launched" },
  { value: "closed", label: "Closed" },
] as const;

const SORTABLE_COLUMNS = ["email", "full_name", "airline", "status", "created_at"] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

function CopyButton({
  value,
  label,
  copyKey,
  copiedKey,
  onCopied,
}: {
  value: string;
  label: string;
  copyKey: string;
  copiedKey: string | null;
  onCopied: (key: string) => void;
}) {
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      onCopied(copyKey);
    } catch {
      // ignore
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      title={`Copy ${label}`}
      className="text-xs text-emerald-400 hover:text-emerald-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {copiedKey === copyKey ? "Copied" : `Copy ${label}`}
    </button>
  );
}

function SortableTh({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sortBy: SortColumn;
  sortDir: "asc" | "desc";
  onSort: () => void;
}) {
  const isActive = sortBy === column;
  return (
    <th className="py-3 pr-4 font-medium">
      <button
        type="button"
        onClick={onSort}
        className="flex items-center gap-1 text-left hover:text-white transition"
      >
        {label}
        {isActive && (
          <span className="text-emerald-400" aria-hidden>
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

function formatRequestedPortal(value: string | null): string {
  if (!value) return "—";
  const v = value.toLowerCase();
  if (v === "fa") return "FA";
  if (v === "pilot" || v === "pilots") return "Pilot";
  return value;
}

type Props = {
  entries: WaitlistEntryRow[];
};

export function WaitlistTableWithFilter({ entries }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortColumn>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filter, search, pageSize]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filter !== "all") {
      result = result.filter((e) => e.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          (e.email?.toLowerCase().includes(q) ?? false) ||
          (e.full_name?.toLowerCase().includes(q) ?? false) ||
          (e.airline?.toLowerCase().includes(q) ?? false) ||
          (formatRequestedPortal(e.requested_portal).toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [entries, filter, search]);

  const sortedEntries = useMemo(() => {
    const arr = [...filteredEntries];
    const cmp = (a: WaitlistEntryRow, b: WaitlistEntryRow): number => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      if (sortBy === "created_at") {
        const aDate = new Date(av as string).getTime();
        const bDate = new Date(bv as string).getTime();
        return sortDir === "asc" ? aDate - bDate : bDate - aDate;
      }
      const aStr = String(av).toLowerCase();
      const bStr = String(bv).toLowerCase();
      const out = aStr.localeCompare(bStr);
      return sortDir === "asc" ? out : -out;
    };
    arr.sort(cmp);
    return arr;
  }, [filteredEntries, sortBy, sortDir]);

  const totalCount = sortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedEntries = useMemo(
    () =>
      sortedEntries.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedEntries, safePage, pageSize]
  );

  useEffect(() => {
    if (expandedRowId && !paginatedEntries.some((e) => e.id === expandedRowId)) {
      setExpandedRowId(null);
    }
  }, [expandedRowId, paginatedEntries]);

  useEffect(() => {
    if (!copiedKey) return;
    const t = setTimeout(() => setCopiedKey(null), 2000);
    return () => clearTimeout(t);
  }, [copiedKey]);

  const hasActiveFilters = filter !== "all" || search.trim() !== "";

  function exportToCsv() {
    const headers = ["email", "full_name", "airline", "role", "status", "created_at"];
    const escape = (v: string | null | undefined): string => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = sortedEntries.map((e) =>
      [
        escape(e.email),
        escape(e.full_name),
        escape(e.airline),
        escape(formatRequestedPortal(e.requested_portal)),
        escape(e.status),
        escape(
          e.created_at ? format(new Date(e.created_at), "yyyy-MM-dd HH:mm:ss") : ""
        ),
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-export-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Filter by waitlist status</label>
          <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Search</label>
          <input
            type="search"
            placeholder="Email, name, airline, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40 min-w-[180px]"
          />
        </div>
        <button
          type="button"
          onClick={exportToCsv}
          disabled={totalCount === 0}
          className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-400">
              <SortableTh
                label="Email"
                column="email"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={() => {
                  if (sortBy === "email") setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                  else {
                    setSortBy("email");
                    setSortDir("desc");
                  }
                }}
              />
              <SortableTh
                label="Full name"
                column="full_name"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={() => {
                  if (sortBy === "full_name") setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                  else {
                    setSortBy("full_name");
                    setSortDir("desc");
                  }
                }}
              />
              <SortableTh
                label="Airline"
                column="airline"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={() => {
                  if (sortBy === "airline") setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                  else {
                    setSortBy("airline");
                    setSortDir("desc");
                  }
                }}
              />
              <th className="py-3 pr-4 font-medium">Role</th>
              <SortableTh
                label="Waitlist Status"
                column="status"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={() => {
                  if (sortBy === "status") setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                  else {
                    setSortBy("status");
                    setSortDir("desc");
                  }
                }}
              />
              <SortableTh
                label="Created"
                column="created_at"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={() => {
                  if (sortBy === "created_at") setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                  else {
                    setSortBy("created_at");
                    setSortDir("desc");
                  }
                }}
              />
              <th className="py-3 pr-4 font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  {entries.length === 0
                    ? "No waitlist entries yet."
                    : hasActiveFilters
                      ? "No matching entries."
                      : `No entries with status "${filter}".`}
                </td>
              </tr>
            )}
            {paginatedEntries.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 pr-4 text-white">{row.email}</td>
                  <td className="py-3 pr-4 text-slate-300">{row.full_name ?? "—"}</td>
                  <td className="py-3 pr-4 text-slate-300">{row.airline}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatRequestedPortal(row.requested_portal)}</td>
                  <td className="py-3 pr-4">
                    <WaitlistStatusSelect id={row.id} currentStatus={row.status ?? "pending"} />
                  </td>
                  <td className="py-3 text-slate-400">
                    {row.created_at
                      ? format(new Date(row.created_at), "MMM d, yyyy HH:mm")
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => setExpandedRowId((id) => (id === row.id ? null : row.id))}
                        className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                      >
                        {expandedRowId === row.id ? "Hide" : "View"}
                      </button>
                      <CopyButton
                        value={row.email ?? ""}
                        label="email"
                        copyKey={`${row.id}-email`}
                        copiedKey={copiedKey}
                        onCopied={setCopiedKey}
                      />
                      <CopyButton
                        value={row.id}
                        label="ID"
                        copyKey={`${row.id}-id`}
                        copiedKey={copiedKey}
                        onCopied={setCopiedKey}
                      />
                    </div>
                  </td>
                </tr>
                {expandedRowId === row.id && (
                  <tr key={`${row.id}-detail`} className="border-b border-white/5 bg-slate-950/60">
                    <td colSpan={7} className="py-4 px-4">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                        <div>
                          <span className="text-slate-500">Email</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{row.email ?? "—"}</span>
                            <CopyButton
                              value={row.email ?? ""}
                              label="email"
                              copyKey={`${row.id}-email`}
                              copiedKey={copiedKey}
                              onCopied={setCopiedKey}
                            />
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Full name</span>
                          <div className="text-slate-300">{row.full_name ?? "—"}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Airline</span>
                          <div className="text-slate-300">{row.airline ?? "—"}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Role</span>
                          <div className="text-slate-300">{formatRequestedPortal(row.requested_portal)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Waitlist Status</span>
                          <div className="text-slate-300">{row.status ?? "—"}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Created</span>
                          <div className="text-slate-300">
                            {row.created_at
                              ? format(new Date(row.created_at), "MMM d, yyyy HH:mm:ss")
                              : "—"}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500">ID</span>
                          <div className="flex items-center flex-wrap gap-1">
                            <span className="font-mono text-xs text-slate-400 break-all">{row.id}</span>
                            <CopyButton
                              value={row.id}
                              label="ID"
                              copyKey={`${row.id}-id`}
                              copiedKey={copiedKey}
                              onCopied={setCopiedKey}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-white/5 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400/40"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-400">
              Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalCount)} of {totalCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
