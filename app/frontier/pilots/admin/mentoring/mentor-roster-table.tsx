"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatUsPhoneStored } from "@/lib/format-us-phone";
import {
  MENTOR_REGISTRY_STATUS_LABELS,
  MENTOR_REGISTRY_STATUS_VALUES,
  MENTOR_REGISTRY_TYPE_LABELS,
  MENTOR_REGISTRY_TYPE_VALUES,
  isMentorRegistryStatusValue,
  isMentorRegistryTypeValue,
} from "@/lib/mentoring/mentor-registry-admin-options";

export type MentorRosterRow = {
  rowKind: "profile" | "preload";
  id: string;
  full_name: string | null;
  employee_number: string | null;
  /** Raw stored phone (profile: mentor_phone || phone; preload: phone). Formatted in UI. */
  phone: string | null;
  /** Raw stored email (profile: mentor_contact_email; preload: work_email). */
  email: string | null;
  /** mentor_preload.personal_email; preload rows only. */
  personal_email?: string | null;
  position: string | null;
  base_airport: string | null;
  /** mentor_preload.notes; preload rows only (import/ops notes, not mentor_registry). */
  preload_notes?: string | null;
  /** mentor_preload.active; preload rows only. */
  preload_active?: boolean;
  mentor_type: string | null;
  mentor_status: string | null;
  admin_notes: string | null;
  mentee_count: number;
};

/** Table display only; DB values stay captain / first_officer / flight_attendant. */
function formatPositionAbbrev(position: string | null | undefined): string {
  const s = (position ?? "").trim().toLowerCase();
  if (!s) return "—";
  if (s === "captain") return "CA";
  if (s === "first_officer") return "FO";
  if (s === "flight_attendant") return "FA";
  return (position ?? "").trim() || "—";
}

function programFieldLabel(kind: "type" | "status", raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (kind === "type" && isMentorRegistryTypeValue(v)) return MENTOR_REGISTRY_TYPE_LABELS[v];
  if (kind === "status" && isMentorRegistryStatusValue(v)) return MENTOR_REGISTRY_STATUS_LABELS[v];
  return v;
}

/** Unified Program cell pill: border + background + text tint from mentor status. */
function mentorProgramPillSurfaceClass(status: MentorRosterRow["mentor_status"]): string {
  const s = (status ?? "").trim();
  if (!isMentorRegistryStatusValue(s)) {
    return "border-white/10 bg-white/[0.04] text-slate-400";
  }
  switch (s) {
    case "active":
      return "border-emerald-500/45 bg-emerald-500/15 text-emerald-200";
    case "non_active":
      return "border-amber-500/45 bg-amber-500/18 text-amber-200";
    case "former":
      return "border-slate-500/45 bg-slate-600/20 text-slate-300";
    case "archived":
      return "border-white/10 bg-white/[0.04] text-slate-500";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-400";
  }
}

/** Table pill only: shorten mapped type label by dropping a trailing " Mentor" (any case). */
function shortenProgramTypeLabelForPill(mappedTypeLabel: string): string {
  const t = mappedTypeLabel.trim();
  if (!t || t === "—") return "—";
  const withoutSuffix = t.replace(/\s+mentor$/i, "").trim();
  return withoutSuffix.length > 0 ? withoutSuffix : t;
}

function programPillDisplay(m: MentorRosterRow): { text: string; title: string; pillClass: string } {
  const typePart = programFieldLabel("type", m.mentor_type) || "—";
  const typePillPart = shortenProgramTypeLabelForPill(typePart);
  const statusRaw = (m.mentor_status ?? "").trim();
  const statusPart = statusRaw
    ? isMentorRegistryStatusValue(statusRaw)
      ? programFieldLabel("status", m.mentor_status)
      : statusRaw
    : "—";
  const text = `${typePillPart.toUpperCase()} • ${statusPart.toUpperCase()}`;
  return {
    text,
    title: `${typePart} • ${statusPart}`,
    pillClass: mentorProgramPillSurfaceClass(m.mentor_status),
  };
}

const NOTES_TABLE_PREVIEW_LEN = 56;

function rosterNotesForTable(m: MentorRosterRow): {
  preview: string;
  title: string;
} {
  const admin = (m.admin_notes ?? "").trim();
  const preload = (m.preload_notes ?? "").trim();
  let title = "";
  let combined = "";
  if (m.rowKind === "preload" && admin && preload) {
    title = `Registry: ${admin}\nImport: ${preload}`;
    combined = `${admin} · ${preload}`;
  } else {
    combined = admin || (m.rowKind === "preload" ? preload : "");
    title = combined;
  }
  if (!combined) return { preview: "", title: "" };
  const preview =
    combined.length > NOTES_TABLE_PREVIEW_LEN
      ? `${combined.slice(0, NOTES_TABLE_PREVIEW_LEN)}…`
      : combined;
  return { preview, title };
}

type Props = {
  rows: MentorRosterRow[];
  saveMentorRegistry: (formData: FormData) => Promise<{ error?: string }>;
  saveMentorPreloadStaging: (formData: FormData) => Promise<{ error?: string }>;
};

const COL_COUNT = 10;

type ClientSortKey = "name" | "emp" | "base" | "mentees";

const PROGRAM_FILTER_EMPTY = "__empty";

/** Fixed width: tight chip; ACTIVE / NON ACTIVE share footprint. Longer combos truncate; full label in title. */
const PROGRAM_PILL_CELL_CLASS =
  "inline-block w-[6.5rem] max-w-full truncate rounded border px-1 py-px text-center text-[9px] font-semibold uppercase leading-none tracking-wide";

/** Compact toolbar selects: low-contrast dark surface (not filled gray panels). */
const ROSTER_FILTER_SELECT_CLASS =
  "h-6 w-full min-w-0 cursor-pointer rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0 pr-5 text-[10px] leading-none text-slate-300 transition-colors [color-scheme:dark] hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18 lg:bg-[length:0.5rem] lg:bg-[position:right_0.28rem_center] lg:bg-no-repeat lg:[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")] lg:appearance-none";

export function MentorRosterTable({ rows, saveMentorRegistry, saveMentorPreloadStaging }: Props) {
  const router = useRouter();
  const [openContactRowKey, setOpenContactRowKey] = useState<string | null>(null);
  const [editRowKey, setEditRowKey] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ClientSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "non_active">("all");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "captain" | "first_officer" | "flight_attendant"
  >("all");
  const [baseFilter, setBaseFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");

  const rowKey = (m: MentorRosterRow) => `${m.rowKind}-${m.id}`;

  const baseOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of rows) {
      const b = (m.base_airport ?? "").trim();
      if (b) s.add(b.toUpperCase());
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const programTypeOptions = useMemo(() => {
    const entries: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const m of rows) {
      const raw = (m.mentor_type ?? "").trim();
      const value = raw || PROGRAM_FILTER_EMPTY;
      if (seen.has(value)) continue;
      seen.add(value);
      const label = raw
        ? programFieldLabel("type", raw) || raw
        : "(No type)";
      entries.push({ value, label });
    }
    return entries.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [rows]);

  function onSortHeaderClick(key: ClientSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: ClientSortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const visibleRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = rows;
    if (q) {
      list = list.filter((m) => {
        const name = (m.full_name ?? "").toLowerCase();
        const emp = (m.employee_number ?? "").toLowerCase();
        const mail = (m.email ?? "").toLowerCase();
        const base = (m.base_airport ?? "").toLowerCase();
        return name.includes(q) || emp.includes(q) || mail.includes(q) || base.includes(q);
      });
    }
    if (statusFilter !== "all") {
      list = list.filter((m) => (m.mentor_status ?? "").trim() === statusFilter);
    }
    if (roleFilter !== "all") {
      list = list.filter((m) => (m.position ?? "").trim().toLowerCase() === roleFilter);
    }
    if (baseFilter !== "all") {
      list = list.filter(
        (m) => (m.base_airport ?? "").trim().toUpperCase() === baseFilter
      );
    }
    if (programFilter !== "all") {
      if (programFilter === PROGRAM_FILTER_EMPTY) {
        list = list.filter((m) => !(m.mentor_type ?? "").trim());
      } else {
        list = list.filter((m) => (m.mentor_type ?? "").trim() === programFilter);
      }
    }

    if (!sortKey) return list;

    const sorted = [...list];
    const dir = sortDir === "asc" ? 1 : -1;
    const tieName = (a: MentorRosterRow, b: MentorRosterRow) => {
      const an = (a.full_name ?? "").trim().toLowerCase() || "\uffff";
      const bn = (b.full_name ?? "").trim().toLowerCase() || "\uffff";
      return an.localeCompare(bn);
    };
    sorted.sort((a, b) => {
      if (sortKey === "name") {
        const an = (a.full_name ?? "").trim().toLowerCase() || "\uffff";
        const bn = (b.full_name ?? "").trim().toLowerCase() || "\uffff";
        return an.localeCompare(bn) * dir;
      }
      if (sortKey === "emp") {
        const ae = (a.employee_number ?? "").trim().toLowerCase() || "\uffff";
        const be = (b.employee_number ?? "").trim().toLowerCase() || "\uffff";
        return ae.localeCompare(be, undefined, { numeric: true }) * dir;
      }
      if (sortKey === "base") {
        const ab = (a.base_airport ?? "").trim().toLowerCase() || "\uffff";
        const bb = (b.base_airport ?? "").trim().toLowerCase() || "\uffff";
        return ab.localeCompare(bb) * dir;
      }
      const ac = a.mentee_count;
      const bc = b.mentee_count;
      const d = (ac - bc) * dir;
      return d !== 0 ? d : tieName(a, b);
    });
    return sorted;
  }, [
    rows,
    search,
    sortKey,
    sortDir,
    statusFilter,
    roleFilter,
    baseFilter,
    programFilter,
  ]);

  const menteesSelectValue: "default" | "high" | "low" =
    sortKey === "mentees" ? (sortDir === "desc" ? "high" : "low") : "default";

  function onMenteesOrderChange(v: "default" | "high" | "low") {
    if (v === "default") {
      setSortKey((k) => (k === "mentees" ? null : k));
      return;
    }
    setSortKey("mentees");
    setSortDir(v === "high" ? "desc" : "asc");
  }

  return (
    <>
      <div className="mb-3 rounded-lg border border-white/10 bg-slate-950/35 px-2.5 py-1.5 lg:mb-2 lg:px-3 lg:py-1">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 content-end gap-x-1.5 gap-y-1 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-1.5 xl:grid-cols-7">
            <label className="min-w-0 sm:col-span-2 md:col-span-3 lg:col-span-2 xl:col-span-2 xl:max-w-[15rem]">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, emp #, email, crew base…"
                className="h-6 w-full max-w-full rounded border border-white/[0.07] bg-white/[0.03] px-1.5 text-[10px] leading-none text-slate-300 placeholder:text-slate-600 transition-colors hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "active" | "non_active")
                }
                className={ROSTER_FILTER_SELECT_CLASS}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="non_active">Non Active</option>
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Role
              </span>
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(
                    e.target.value as "all" | "captain" | "first_officer" | "flight_attendant"
                  )
                }
                className={ROSTER_FILTER_SELECT_CLASS}
              >
                <option value="all">All</option>
                <option value="captain">CA</option>
                <option value="first_officer">FO</option>
                <option value="flight_attendant">FA</option>
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Crew base
              </span>
              <select
                value={baseFilter}
                onChange={(e) => setBaseFilter(e.target.value)}
                className={ROSTER_FILTER_SELECT_CLASS}
              >
                <option value="all">All</option>
                {baseOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Program
              </span>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className={ROSTER_FILTER_SELECT_CLASS}
              >
                <option value="all">All</option>
                {programTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Mentees
              </span>
              <select
                value={menteesSelectValue}
                onChange={(e) =>
                  onMenteesOrderChange(e.target.value as "default" | "high" | "low")
                }
                className={ROSTER_FILTER_SELECT_CLASS}
              >
                <option value="default">Default order</option>
                <option value="high">Count high → low</option>
                <option value="low">Count low → high</option>
              </select>
            </label>
          </div>
          <div className="flex min-h-6 shrink-0 items-center border-t border-white/5 pt-2 text-[10px] tabular-nums leading-none text-slate-500 sm:justify-end lg:min-h-0 lg:min-w-[10.5rem] lg:self-stretch lg:border-t-0 lg:border-l lg:border-white/[0.07] lg:pt-0 lg:pl-3 lg:pr-0.5 lg:items-end lg:justify-end">
            <span className="whitespace-nowrap lg:inline-block lg:rounded lg:border lg:border-white/[0.05] lg:bg-white/[0.02] lg:px-1.5 lg:py-px">
              <span className="font-medium text-slate-400">{visibleRows.length}</span>
              <span className="text-slate-600"> shown</span>
              <span className="text-slate-600"> · </span>
              <span className="font-medium text-slate-400">{rows.length}</span>
              <span className="text-slate-600"> in roster</span>
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/5 lg:-mt-px">
        <table className="table-fixed w-full min-w-[980px] text-xs leading-tight">
          <colgroup>
            <col className="w-[2.75rem]" />
            <col className="min-w-0 w-[20%] lg:w-[19%]" />
            <col className="w-[4.75rem]" />
            <col className="w-[2.5rem]" />
            <col className="w-[3.75rem]" />
            <col className="w-[6.25rem]" />
            <col className="w-[7.5rem] lg:w-[8.25rem]" />
            <col className="min-w-0 lg:w-[18%]" />
            <col className="w-[3.75rem]" />
            <col className="w-[3.25rem]" />
          </colgroup>
          <thead className="border-b border-white/5 bg-white/[0.03] text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-0.5 py-1.5 text-center">CRA</th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">
                <button
                  type="button"
                  onClick={() => onSortHeaderClick("name")}
                  className="max-w-full truncate text-left font-medium text-slate-400 hover:text-slate-200 touch-manipulation"
                >
                  Name{sortIndicator("name")}
                </button>
              </th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">
                <button
                  type="button"
                  onClick={() => onSortHeaderClick("emp")}
                  className="font-medium text-slate-400 hover:text-slate-200 touch-manipulation"
                >
                  Emp.#{sortIndicator("emp")}
                </button>
              </th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">Role</th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">
                <button
                  type="button"
                  onClick={() => onSortHeaderClick("base")}
                  className="font-medium text-slate-400 hover:text-slate-200 touch-manipulation"
                  title="Crew base"
                >
                  Crew base{sortIndicator("base")}
                </button>
              </th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">Phone</th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">Program</th>
              <th className="px-1.5 py-1.5 text-left normal-case tracking-normal">Notes</th>
              <th className="px-1.5 py-1.5 text-right normal-case tracking-normal">
                <button
                  type="button"
                  onClick={() => onSortHeaderClick("mentees")}
                  className="inline-block w-full text-right font-medium text-slate-400 hover:text-slate-200 touch-manipulation"
                >
                  Mentees{sortIndicator("mentees")}
                </button>
              </th>
              <th className="px-1 py-1.5 text-center normal-case tracking-normal">Edit</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {visibleRows.map((m) => {
              const rk = rowKey(m);
              const craOnCrewRules = m.rowKind === "profile";
              const count = m.mentee_count;
              const name = m.full_name?.trim() || "—";
              const emp = (m.employee_number ?? "").trim() || "—";
              const phoneFormatted = formatUsPhoneStored(m.phone);
              const contactEmail = (m.email ?? "").trim() || null;
              const posLabel = formatPositionAbbrev(m.position);
              const baseLabel = (m.base_airport ?? "").trim() || "—";
              const programPill = programPillDisplay(m);

              const { preview: notesPreview, title: notesTitle } = rosterNotesForTable(m);

              const typeDefault =
                m.mentor_type && isMentorRegistryTypeValue(m.mentor_type) ? m.mentor_type : "";
              const statusDefault =
                m.mentor_status && isMentorRegistryStatusValue(m.mentor_status)
                  ? m.mentor_status
                  : "";

              const isInactivePreload = m.rowKind === "preload" && m.preload_active === false;

              return (
                <Fragment key={rk}>
                  <tr
                    className={[
                      "border-t border-white/5",
                      isInactivePreload ? "border-l-2 border-l-slate-600 bg-slate-950/35" : "",
                    ].join(" ")}
                  >
                    <td className="px-0.5 py-1.5 align-middle text-center">
                      {craOnCrewRules ? (
                        <span className="text-sm font-semibold leading-none text-emerald-400" title="On CrewRules">
                          ✓
                        </span>
                      ) : isInactivePreload ? (
                        <span
                          className="text-sm font-semibold leading-none text-amber-500/45 ring-1 ring-slate-600/80 rounded px-0.5"
                          title="Preload — inactive staging (not on CrewRules; marked inactive in mentor preload)"
                        >
                          ✕
                        </span>
                      ) : (
                        <span
                          className="text-sm font-semibold leading-none text-amber-400"
                          title="Preload — not on CrewRules yet"
                        >
                          ✕
                        </span>
                      )}
                    </td>
                    <td className="max-w-0 px-1.5 py-1.5 align-middle text-slate-200">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenContactRowKey((k) => (k === rk ? null : rk))
                          }
                          className="truncate text-left font-medium text-slate-200 hover:underline touch-manipulation"
                          title="Show mentor contact"
                        >
                          {name}
                        </button>
                        {openContactRowKey === rk ? (
                          <div className="space-y-0.5 text-[10px] leading-snug text-slate-500">
                            {contactEmail ? (
                              <a
                                href={`mailto:${contactEmail}`}
                                className="break-all font-normal text-[#75C043] hover:underline"
                              >
                                {contactEmail}
                              </a>
                            ) : (
                              <span className="font-normal">No mentor contact email on file</span>
                            )}
                            {phoneFormatted ? (
                              <div className="font-normal text-slate-500">{phoneFormatted}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 align-middle">
                      <div className="truncate font-mono text-[11px] text-slate-400" title={emp}>
                        {emp}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 align-middle text-center text-slate-400">{posLabel}</td>
                    <td className="px-1.5 py-1.5 align-middle font-mono text-[11px] text-slate-400">
                      <div className="truncate" title={baseLabel}>
                        {baseLabel}
                      </div>
                    </td>
                    <td className="max-w-0 px-1.5 py-1.5 align-middle text-slate-400">
                      <div className="truncate font-mono text-[11px]" title={phoneFormatted || undefined}>
                        {phoneFormatted || "—"}
                      </div>
                    </td>
                    <td className="max-w-0 px-1.5 py-1.5 align-middle">
                      <span
                        className={[PROGRAM_PILL_CELL_CLASS, programPill.pillClass].join(" ")}
                        title={programPill.title}
                      >
                        {programPill.text}
                      </span>
                    </td>
                    <td className="max-w-0 px-1.5 py-1.5 align-middle text-slate-500">
                      {notesPreview ? (
                        <p className="truncate text-[11px] leading-tight text-slate-500" title={notesTitle}>
                          {notesPreview}
                        </p>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-slate-400">{count}</td>
                    <td className="px-1 py-1.5 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => {
                          setEditError(null);
                          setStagingError(null);
                          setEditRowKey((k) => (k === rk ? null : rk));
                        }}
                        className="touch-manipulation text-[11px] font-semibold leading-none text-[#75C043] hover:underline"
                      >
                        {editRowKey === rk ? "Close" : "Update"}
                      </button>
                    </td>
                  </tr>
                  {editRowKey === rk ? (
                    <tr className="border-t border-white/5 bg-slate-900/50">
                      <td colSpan={COL_COUNT} className="px-3 py-5 sm:px-5">
                        <div className="max-w-3xl space-y-5 text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/10 pb-3">
                            <span
                              className={
                                craOnCrewRules
                                  ? "rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200"
                                  : "rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200"
                              }
                            >
                              {craOnCrewRules ? "Live" : "Staging"}
                            </span>
                            <span className="font-semibold text-slate-100">{name}</span>
                            <span className="font-mono text-xs text-slate-500">{emp}</span>
                            <span className="text-xs text-slate-500">
                              {posLabel} · <span className="font-mono">{baseLabel}</span>
                            </span>
                          </div>

                          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-400 shadow-sm shadow-black/20">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Contact
                            </p>
                            <dl className="mt-2 space-y-2">
                              {m.rowKind === "preload" ? (
                                <>
                                  <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                                    <dt className="text-slate-500">Full Name</dt>
                                    <dd className="text-slate-200">{name}</dd>
                                  </div>
                                  <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                                    <dt className="text-slate-500">Personal email</dt>
                                    <dd className="break-all font-medium text-slate-200">
                                      {(m.personal_email ?? "").trim() ? (
                                        <a
                                          href={`mailto:${(m.personal_email ?? "").trim()}`}
                                          className="text-[#75C043] hover:underline"
                                        >
                                          {(m.personal_email ?? "").trim()}
                                        </a>
                                      ) : (
                                        "—"
                                      )}
                                    </dd>
                                  </div>
                                  <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                                    <dt className="text-slate-500">Work / Company email</dt>
                                    <dd className="break-all text-slate-300">
                                      {contactEmail ? (
                                        <a
                                          href={`mailto:${contactEmail}`}
                                          className="text-[#75C043] hover:underline"
                                        >
                                          {contactEmail}
                                        </a>
                                      ) : (
                                        "—"
                                      )}
                                    </dd>
                                  </div>
                                  <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                                    <dt className="text-slate-500">Phone</dt>
                                    <dd className="text-slate-200">{phoneFormatted || "—"}</dd>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                                    <dt className="text-slate-500">Contact email</dt>
                                    <dd className="break-all text-slate-200">
                                      {contactEmail ? (
                                        <a
                                          href={`mailto:${contactEmail}`}
                                          className="text-[#75C043] hover:underline"
                                        >
                                          {contactEmail}
                                        </a>
                                      ) : (
                                        "—"
                                      )}
                                    </dd>
                                  </div>
                                  <p className="text-[10px] leading-snug text-slate-600">
                                    Uses mentor contact email when set on the profile; otherwise the pilot&apos;s
                                    profile email.
                                  </p>
                                  <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                                    <dt className="text-slate-500">Phone</dt>
                                    <dd className="text-slate-200">{phoneFormatted || "—"}</dd>
                                  </div>
                                </>
                              )}
                            </dl>
                          </div>

                          {m.rowKind === "profile" ? (
                            <p className="text-xs leading-relaxed text-slate-400">
                              Identity fields (name, employee #, phone, contact email as shown above, position, crew
                              base) come from this pilot&apos;s CrewRules profile. Update them in{" "}
                              <Link
                                href="/frontier/pilots/admin/users"
                                className="font-medium text-[#75C043] hover:underline"
                              >
                                Users
                              </Link>{" "}
                              or the pilot&apos;s own Profile settings when applicable.
                            </p>
                          ) : null}

                          <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/30 p-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-200">Mentor Program</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Saved to Mentor Registry — Does not change pilot profile fields.
                              </p>
                            </div>
                            <form
                              className="space-y-3"
                              onSubmit={(e) => {
                                e.preventDefault();
                                setEditError(null);
                                const fd = new FormData(e.currentTarget);
                                startTransition(async () => {
                                  const result = await saveMentorRegistry(fd);
                                  if (result.error) {
                                    setEditError(result.error);
                                    return;
                                  }
                                  setEditRowKey(null);
                                  router.refresh();
                                });
                              }}
                            >
                              <input type="hidden" name="rowKind" value={m.rowKind} />
                              <input type="hidden" name="rowId" value={m.id} />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block space-y-1">
                                  <span className="text-xs text-slate-400">Mentor type</span>
                                  <select
                                    name="mentor_type"
                                    required
                                    defaultValue={typeDefault}
                                    className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                  >
                                    <option value="" disabled>
                                      Select type…
                                    </option>
                                    {MENTOR_REGISTRY_TYPE_VALUES.map((v) => (
                                      <option key={v} value={v}>
                                        {MENTOR_REGISTRY_TYPE_LABELS[v]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block space-y-1">
                                  <span className="text-xs text-slate-400">Mentor status</span>
                                  <select
                                    name="mentor_status"
                                    required
                                    defaultValue={statusDefault}
                                    className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                  >
                                    <option value="" disabled>
                                      Select status…
                                    </option>
                                    {MENTOR_REGISTRY_STATUS_VALUES.map((v) => (
                                      <option key={v} value={v}>
                                        {MENTOR_REGISTRY_STATUS_LABELS[v]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="block space-y-1">
                                <span className="text-xs text-slate-400">Admin notes (optional)</span>
                                <textarea
                                  name="admin_notes"
                                  rows={3}
                                  defaultValue={m.admin_notes ?? ""}
                                  className="w-full resize-y rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                                  placeholder="Internal notes for admins (mentor registry)"
                                />
                              </label>
                              {editError ? (
                                <p className="text-xs text-red-400" role="alert">
                                  {editError}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="submit"
                                  disabled={pending}
                                  className="inline-flex rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                                >
                                  {pending ? "Saving…" : "Save Program Status"}
                                </button>
                              </div>
                            </form>
                          </div>

                          {m.rowKind === "preload" ? (
                            <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/30 p-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-200">Staging Identity</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Updates Mentor preload only. When this pilot links a CrewRules account, profile data
                                  becomes source of truth.
                                </p>
                              </div>
                              <form
                                className="space-y-3"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  setStagingError(null);
                                  const fd = new FormData(e.currentTarget);
                                  startTransition(async () => {
                                    const result = await saveMentorPreloadStaging(fd);
                                    if (result.error) {
                                      setStagingError(result.error);
                                      return;
                                    }
                                    setEditRowKey(null);
                                    router.refresh();
                                  });
                                }}
                              >
                                <input type="hidden" name="preloadId" value={m.id} />
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="block space-y-1 sm:col-span-2">
                                    <span className="text-xs text-slate-400">Full Name</span>
                                    <input
                                      name="full_name"
                                      type="text"
                                      defaultValue={m.full_name ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs text-slate-400">Employee number</span>
                                    <input
                                      name="employee_number"
                                      type="text"
                                      required
                                      defaultValue={m.employee_number ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs text-slate-400">Roster status</span>
                                    <select
                                      name="preload_active"
                                      defaultValue={m.preload_active !== false ? "true" : "false"}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    >
                                      <option value="true">Active (normal staging)</option>
                                      <option value="false">Inactive (stays on roster, muted)</option>
                                    </select>
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs text-slate-400">Phone</span>
                                    <input
                                      name="phone"
                                      type="text"
                                      defaultValue={m.phone ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs text-slate-400">Work email</span>
                                    <input
                                      name="work_email"
                                      type="email"
                                      defaultValue={m.email ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    />
                                  </label>
                                  <label className="block space-y-1 sm:col-span-2">
                                    <span className="text-xs text-slate-400">Personal email (optional)</span>
                                    <input
                                      name="personal_email"
                                      type="email"
                                      defaultValue={m.personal_email ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs text-slate-400">Position</span>
                                    <select
                                      name="position"
                                      defaultValue={m.position ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200"
                                    >
                                      <option value="">—</option>
                                      <option value="captain">Captain</option>
                                      <option value="first_officer">First Officer</option>
                                      <option value="flight_attendant">Flight Attendant</option>
                                    </select>
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs text-slate-400">Crew base (3-letter IATA)</span>
                                    <input
                                      name="base_airport"
                                      type="text"
                                      maxLength={3}
                                      defaultValue={m.base_airport ?? ""}
                                      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200 uppercase font-mono"
                                    />
                                  </label>
                                  <label className="block space-y-1 sm:col-span-2">
                                    <span className="text-xs text-slate-400">Preload notes (optional)</span>
                                    <textarea
                                      name="preload_notes"
                                      rows={2}
                                      defaultValue={m.preload_notes ?? ""}
                                      className="w-full resize-y rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                                      placeholder="Import or ops notes stored on mentor preload"
                                    />
                                  </label>
                                </div>
                                {stagingError ? (
                                  <p className="text-xs text-red-400" role="alert">
                                    {stagingError}
                                  </p>
                                ) : null}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="submit"
                                    disabled={pending}
                                    className="inline-flex rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                                  >
                                    {pending ? "Saving…" : "Save Staging Identity"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          ) : null}

                          {(m.admin_notes ?? "").trim() || (m.preload_notes ?? "").trim() ? (
                            <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-400">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Notes (full)
                              </p>
                              <div className="mt-2 space-y-3 whitespace-pre-wrap break-words text-slate-300">
                                {(m.admin_notes ?? "").trim() ? (
                                  <div>
                                    <p className="text-[10px] font-medium text-slate-500">Registry admin</p>
                                    <p className="mt-1 text-sm leading-relaxed">{(m.admin_notes ?? "").trim()}</p>
                                  </div>
                                ) : null}
                                {m.rowKind === "preload" && (m.preload_notes ?? "").trim() ? (
                                  <div>
                                    <p className="text-[10px] font-medium text-slate-500">Preload / import</p>
                                    <p className="mt-1 text-sm leading-relaxed">{(m.preload_notes ?? "").trim()}</p>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                setEditError(null);
                                setStagingError(null);
                                setEditRowKey(null);
                              }}
                              className="inline-flex rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                            >
                              Close Panel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
