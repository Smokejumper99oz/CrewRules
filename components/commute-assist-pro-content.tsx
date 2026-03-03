"use client";

import { useState, useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { subMinutes } from "date-fns";
import { getCommuteSearchWindowsToBase } from "@/lib/commute/commute-windows";
import { getCommuteFlightProvider } from "@/lib/commute/providers/provider";
import type { CommuteFlightOption } from "@/lib/commute/providers/types";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";

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

  useEffect(() => {
    void (async () => {
      try {
        const baseTz = displaySettings.baseTimezone;
        const homeTz = profile?.base_timezone ?? displaySettings.baseTimezone;
        const arrivalBuffer = profile?.commute_arrival_buffer_minutes ?? 180;
        const baseAirport = profile?.base_airport || displaySettings.baseAirport || "Base";
        let showInfo = false;
        let arriveByFormatted = "";
        let dutyOk = false;
        const grouped: Record<string, CommuteFlightOption[]> = {};

        const dutyStart = new Date(event.start_time);
        dutyOk = !Number.isNaN(dutyStart.getTime());
        if (dutyOk) {
          const arriveBy = subMinutes(dutyStart, arrivalBuffer);
          arriveByFormatted = formatInTimeZone(arriveBy, baseTz, "HH:mm");
          const windows = getCommuteSearchWindowsToBase(dutyStart.toISOString(), baseTz, homeTz);
          showInfo = true;
          const provider = getCommuteFlightProvider(tenant, portal);
          for (const w of windows) {
            const results = await provider.searchToBase({
              tenant,
              portal,
              fromAirport: profile.home_airport!,
              toAirport: baseAirport,
              startUtc: w.startUtc,
              endUtc: w.endUtc,
              nonstopOnly: profile?.commute_nonstop_only ?? false,
              arrivalBufferMinutes: arrivalBuffer,
              arriveByUtc: arriveBy.toISOString(),
              baseTimezone: baseTz,
            });
            if (!grouped[w.kind]) grouped[w.kind] = [];
            grouped[w.kind].push(...results);
          }
          for (const key of Object.keys(grouped)) {
            grouped[key].sort(
              (a, b) => new Date(a.depUtc).getTime() - new Date(b.depUtc).getTime()
            );
          }
        }

        const hasDayPrior = !!grouped.day_prior?.length;
        const hasSameDay = !!grouped.same_day?.length;
        let searchingText = "";
        if (hasDayPrior && hasSameDay) {
          searchingText = "Day prior + Day of";
        } else if (hasDayPrior) {
          searchingText = "Day prior (00:00–23:59)";
        } else if (hasSameDay) {
          searchingText = "Day of";
        }

        setCommuteError(null);
        setCommuteGroups(grouped);
        setCommuteMeta({ showInfo, arriveByFormatted, dutyOk, searchingText });
      } catch (err) {
        console.error("Commute Assist failed", err);
        setCommuteError("Commute Assist temporarily unavailable.");
        setCommuteGroups({ day_prior: [], same_day: [] });
        setCommuteMeta(null);
      }
    })();
  }, [event.start_time, profile, displaySettings, tenant, portal]);

  const baseTz = displaySettings.baseTimezone;
  const baseAirport = profile?.base_airport || displaySettings.baseAirport || "Base";

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

  const { showInfo, arriveByFormatted, dutyOk, searchingText } = commuteMeta;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm text-slate-300">
        {profile.home_airport} → {baseAirport}
      </p>
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
