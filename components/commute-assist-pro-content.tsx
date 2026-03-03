"use client";

import { useState, useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { subMinutes } from "date-fns";
import type { CommuteFlightOption } from "@/lib/commute/providers/types";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import type { CommuteFlight } from "@/lib/aviationstack";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";

function fmtHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function minutesBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

type Props = {
  event: { start_time: string };
  profile: NonNullable<Profile>;
  displaySettings: ScheduleDisplaySettings;
  tenant: string;
  portal: string;
};

const badgeStyles = {
  recommended: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  risky: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  not_recommended: "border-red-500/30 bg-red-500/10 text-red-200",
};

const badgeLabels = {
  recommended: "✅ Recommended",
  risky: "⚠️ Risky",
  not_recommended: "🚫 Not recommended",
};

export function CommuteAssistProContent({ event, profile, displaySettings, tenant, portal }: Props) {
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteGroups, setCommuteGroups] = useState<Record<string, CommuteFlightOption[]>>({
    day_prior: [],
    same_day: [],
  });
  const [commuteMeta, setCommuteMeta] = useState<{
    showInfo: boolean;
    arriveByFormatted: string;
    dutyOk: boolean;
    searchingText: string;
  } | null>(null);
  const [source, setSource] = useState<"cache" | "api" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const baseTz = displaySettings.baseTimezone;
  const baseAirport = profile?.base_airport || displaySettings.baseAirport || "Base";
  const arrivalBuffer = profile?.commute_arrival_buffer_minutes ?? 60;
  const dutyStart = new Date(event.start_time);
  const dutyOk = !Number.isNaN(dutyStart.getTime());
  const arriveBy = dutyOk ? subMinutes(dutyStart, arrivalBuffer) : null;

  async function loadFlights(opts?: { forceRefresh?: boolean }) {
    try {
      setCommuteError(null);
      setNotice(null);
      if (opts?.forceRefresh) setRefreshing(true);

      const res = await getCommuteFlights({
        origin: profile.home_airport ?? "TPA",
        destination: baseAirport === "Base" ? "SJU" : baseAirport,
        date: dutyOk ? dutyStart.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        forceRefresh: opts?.forceRefresh ?? false,
      });

      const arriveByFormatted = arriveBy ? formatInTimeZone(arriveBy, baseTz, "HH:mm") : "";
      const showInfo = dutyOk;

      if (res.ok) {
        setSource(res.source);
        const flights = res.flights;
        const dutyDateStr = dutyOk ? dutyStart.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const reportAtIso = dutyOk ? dutyStart.toISOString() : `${dutyDateStr}T12:00:00Z`;

        const options: CommuteFlightOption[] = (flights as CommuteFlight[]).map((f, i) => {
          const bufferMin = minutesBetween(f.arrivalTime, reportAtIso);
          let risk: "recommended" | "risky" | "not_recommended" = "recommended";
          let reason = "";

          if (bufferMin < arrivalBuffer) {
            risk = "not_recommended";
            reason = `Arrives after cutoff (${bufferMin}m < ${arrivalBuffer}m)`;
          } else if (bufferMin < arrivalBuffer + 60) {
            risk = "risky";
            reason = `Meets cutoff but tight (${bufferMin}m)`;
          } else {
            risk = "recommended";
            reason = `Good buffer (${bufferMin}m)`;
          }
          reason = `${reason} • ${fmtHM(f.durationMinutes)}`;

          return {
            id: `${f.flightNumber}-${f.departureTime}-${i}`,
            carrier: f.carrier,
            flight: f.flightNumber.replace(f.carrier, "").trim() || f.flightNumber,
            depUtc: f.departureTime,
            arrUtc: f.arrivalTime,
            nonstop: true,
            risk,
            reason,
          };
        });

        const grouped: Record<string, CommuteFlightOption[]> = {
          day_prior: [],
          same_day: options,
        };
        const searchingText = options.length ? "Day of" : "";

        setCommuteGroups(grouped);
        setCommuteMeta({ showInfo, arriveByFormatted, dutyOk, searchingText });
        setNotice(null);
        return res.flights;
      } else {
        setNotice(res.message);
        setSource(null);
        setCommuteMeta({ showInfo, arriveByFormatted, dutyOk, searchingText: "" });
        return null;
      }
    } catch (err) {
      console.error("Commute Assist failed", err);
      setCommuteError("Commute Assist temporarily unavailable.");
      setSource(null);
      return null;
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadFlights();
  }, [event.start_time, profile, displaySettings, tenant, portal]);

  if (commuteError) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm text-slate-300">
          {profile.home_airport} → {baseAirport}
        </p>
        <p className="text-xs text-amber-200/90">{commuteError}</p>
      </div>
    );
  }

  if (!commuteMeta) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm text-slate-300">
          {profile.home_airport} → {baseAirport}
        </p>
        <p className="text-xs text-slate-500">Loading commute options…</p>
      </div>
    );
  }

  const { showInfo, arriveByFormatted, searchingText } = commuteMeta;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          {profile.home_airport} → {baseAirport}
        </p>
        <div className="flex items-center gap-2">
          {source && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
              {source === "cache" ? "Cached" : "Live"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadFlights({ forceRefresh: true })}
            disabled={refreshing}
            className="rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-900/70 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {notice && (
        <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {notice}
        </div>
      )}
      {showInfo ? (
        <>
          <p className="text-xs text-slate-400">
            Arrive by: {arriveByFormatted} (base)
          </p>
          {searchingText && (
            <div className="text-xs text-slate-400">
              Searching: {searchingText}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400">Commute timing unavailable for this event.</p>
      )}
      {dutyOk && (
        <div className="space-y-1.5">
          {(!commuteGroups.day_prior?.length && !commuteGroups.same_day?.length) ? (
            <p className="text-xs text-slate-500">No commute options found in this window.</p>
          ) : (
            <>
              {commuteGroups.day_prior?.length ? (
                <>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2">Day prior</p>
                  {commuteGroups.day_prior.map((opt) => {
                    const dep = new Date(opt.depUtc);
                    const arr = new Date(opt.arrUtc);
                    return (
                      <div key={opt.id} className="grid grid-cols-[1fr_auto] items-start gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${badgeStyles[opt.risk]}`}>
                              {badgeLabels[opt.risk]}
                            </span>
                            <span className="text-slate-300 text-sm">
                              {formatInTimeZone(dep, baseTz, "HH:mm")} → {formatInTimeZone(arr, baseTz, "HH:mm")}
                            </span>
                          </div>
                          {opt.reason && (
                            <span className="text-slate-500 text-sm">— {opt.reason}</span>
                          )}
                        </div>
                        <div className="pt-1 text-xs text-slate-500 whitespace-nowrap">
                          {opt.carrier} {opt.flight ?? ""}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
              {commuteGroups.same_day?.length ? (
                <>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2">Day of (before duty)</p>
                  {commuteGroups.same_day.map((opt) => {
                    const dep = new Date(opt.depUtc);
                    const arr = new Date(opt.arrUtc);
                    return (
                      <div key={opt.id} className="grid grid-cols-[1fr_auto] items-start gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${badgeStyles[opt.risk]}`}>
                              {badgeLabels[opt.risk]}
                            </span>
                            <span className="text-slate-300 text-sm">
                              {formatInTimeZone(dep, baseTz, "HH:mm")} → {formatInTimeZone(arr, baseTz, "HH:mm")}
                            </span>
                          </div>
                          {opt.reason && (
                            <span className="text-slate-500 text-sm">— {opt.reason}</span>
                          )}
                        </div>
                        <div className="pt-1 text-xs text-slate-500 whitespace-nowrap">
                          {opt.carrier} {opt.flight ?? ""}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
