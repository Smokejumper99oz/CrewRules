"use client";

import { useState, useEffect } from "react";
import { updateProfilePreferences } from "@/app/frontier/pilots/portal/profile/actions";
import { DatePickerInput } from "@/components/date-picker-input";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Puerto_Rico",
  "America/Miami",
  "America/Mexico_City",
  "America/Toronto",
  "America/Vancouver",
  "UTC",
];

type Props = {
  profile: {
    email: string | null;
    full_name?: string | null;
    employee_number?: string | null;
    date_of_hire?: string | null;
    position?: "captain" | "first_officer" | "flight_attendant" | null;
    base_airport?: string | null;
    equipment?: string | null;
    base_timezone?: string;
    display_timezone_mode?: "base" | "device" | "toggle" | "both";
    time_format?: "24h" | "12h";
    show_timezone_label?: boolean;
  };
};

const COMMON_AIRPORTS = ["SJU", "DEN", "MCO", "LAS", "PHX", "MIA", "ORD", "DFW", "ATL", "FLL", "BOS", "IAH", "LAX", "SFO"];

const AIRPORT_TO_TIMEZONE: Record<string, string> = {
  SJU: "America/Puerto_Rico",
  DEN: "America/Denver",
  MCO: "America/New_York",
  LAS: "America/Los_Angeles",
  PHX: "America/Phoenix",
  MIA: "America/New_York",
  ORD: "America/Chicago",
  DFW: "America/Chicago",
  ATL: "America/New_York",
  FLL: "America/New_York",
  BOS: "America/New_York",
  IAH: "America/Chicago",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
};

const DEFAULT_TIMEZONE = "America/Denver";

function getTimezoneFromAirport(airport: string): string {
  return AIRPORT_TO_TIMEZONE[airport] ?? DEFAULT_TIMEZONE;
}

function getTimezoneAbbreviation(iana: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value ?? "";
  } catch {
    return "";
  }
}

export function ProfileForm({ profile }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [baseAirport, setBaseAirport] = useState(profile.base_airport ?? "");
  const storedTimezone = profile.base_timezone ?? DEFAULT_TIMEZONE;
  const derivedFromBase = getTimezoneFromAirport(profile.base_airport ?? "DEN");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualTimezone, setManualTimezone] = useState(storedTimezone);

  const displayTimezoneMode = profile.display_timezone_mode ?? "base";
  const timeFormat = profile.time_format ?? "24h";
  const showTimezoneLabel = profile.show_timezone_label ?? false;

  const derivedTimezone = getTimezoneFromAirport(baseAirport || "DEN");
  const effectiveTimezone = showAdvanced ? manualTimezone : derivedTimezone;
  const tzAbbr = getTimezoneAbbreviation(effectiveTimezone);
  const tzLabel = baseAirport
    ? tzAbbr
      ? `${tzAbbr} (${effectiveTimezone.replace(/_/g, " ")})`
      : effectiveTimezone.replace(/_/g, " ")
    : "—";

  useEffect(() => {
    if (showAdvanced) {
      setManualTimezone(getTimezoneFromAirport(baseAirport || "DEN"));
    }
  }, [baseAirport, showAdvanced]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("base_timezone", effectiveTimezone);
    setSaving(true);
    setMessage(null);
    const result = await updateProfilePreferences(formData);
    setSaving(false);
    if ("error" in result) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Saved." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Personal Information */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4">1. Personal Information</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-300">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={profile.full_name ?? ""}
              placeholder="e.g. Jane Smith"
              className="mt-1.5 w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30"
            />
          </div>
          <div>
            <label htmlFor="employee_number" className="block text-sm font-medium text-slate-300">
              Employee number
            </label>
            <input
              id="employee_number"
              name="employee_number"
              type="text"
              defaultValue={profile.employee_number ?? ""}
              placeholder="e.g. 12345"
              className="mt-1.5 w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30"
            />
            <p className="mt-1 text-xs text-slate-500">
              Employee number is used for internal portal identification
            </p>
          </div>
          <div>
            <label htmlFor="date_of_hire" className="block text-sm font-medium text-slate-300">
              Date of Hire (DOH)
            </label>
            <DatePickerInput
              id="date_of_hire"
              name="date_of_hire"
              value={profile.date_of_hire ?? undefined}
              placeholder="mm/dd/yyyy"
              className="mt-1.5 w-full max-w-[12rem] rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 cursor-pointer"
            />
            <p className="mt-1 text-xs text-slate-500">
              Used for calculations only. Never shared.
            </p>
          </div>
          <div>
            <label htmlFor="position" className="block text-sm font-medium text-slate-300">
              Role
            </label>
            <select
              id="position"
              name="position"
              defaultValue={profile.position ?? ""}
              className="profile-select mt-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 [&>option]:bg-slate-900 [&>option]:text-slate-200"
            >
              <option value="">Select role</option>
              <option value="captain">Captain</option>
              <option value="first_officer">First Officer</option>
              <option value="flight_attendant">Flight Attendant</option>
            </select>
          </div>
          <div>
            <label htmlFor="base_airport" className="block text-sm font-medium text-slate-300">
              Crew Base
            </label>
            <select
              id="base_airport"
              name="base_airport"
              value={baseAirport}
              onChange={(e) => setBaseAirport(e.target.value)}
              className="profile-select mt-1.5 w-full max-w-[8rem] rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 [&>option]:bg-slate-900 [&>option]:text-slate-200"
            >
              <option value="">Select crew base</option>
              {[...new Set([...(baseAirport && !COMMON_AIRPORTS.includes(baseAirport) ? [baseAirport] : []), ...COMMON_AIRPORTS])]
                .sort()
                .map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">3-letter IATA code</p>
            <p className="mt-2 text-sm text-slate-400">
              Timezone: <span className="font-medium text-slate-200">{tzLabel}</span>
            </p>
            <input type="hidden" name="base_timezone" value={effectiveTimezone} />
            <button
              type="button"
              onClick={() => {
                if (!showAdvanced) {
                  setManualTimezone(getTimezoneFromAirport(baseAirport || "DEN"));
                }
                setShowAdvanced(!showAdvanced);
              }}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
            >
              {showAdvanced ? "Hide advanced" : "Advanced"}
            </button>
            {showAdvanced && (
              <div className="mt-3">
                <label htmlFor="base_timezone_override" className="block text-sm font-medium text-slate-300">
                  Override crew base timezone
                </label>
                <select
                  id="base_timezone_override"
                  value={manualTimezone}
                  onChange={(e) => setManualTimezone(e.target.value)}
                  className="profile-select mt-1.5 w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 [&>option]:bg-slate-900 [&>option]:text-slate-200"
                >
                  {[...new Set([...(COMMON_TIMEZONES.includes(manualTimezone) ? [] : [manualTimezone]), ...COMMON_TIMEZONES])].map(
                    (tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="equipment" className="block text-sm font-medium text-slate-300">
              Equipment <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              id="equipment"
              name="equipment"
              type="text"
              defaultValue={profile.equipment ?? "A320/A321"}
              placeholder="e.g. A320, A321"
              className="mt-1.5 w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30"
            />
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <span className="text-xs font-medium text-slate-500">Email (account)</span>
          <p className="text-sm text-white">{profile.email ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Managed via your account provider.</p>
        </div>
      </section>

      {/* Subscription */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">Subscription</h2>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-6 text-center">
          <p className="text-sm text-slate-500">Coming soon.</p>
        </div>
      </section>

      {/* Schedule display */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4">Schedule display</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="display_timezone_mode" className="block text-sm font-medium text-slate-300">
              Schedule display mode
            </label>
            <select
              id="display_timezone_mode"
              name="display_timezone_mode"
              defaultValue={displayTimezoneMode === "toggle" ? "both" : displayTimezoneMode}
              className="profile-select mt-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 [&>option]:bg-slate-900 [&>option]:text-slate-200"
            >
              <option value="base">Base time (recommended)</option>
              <option value="device">Device local time</option>
              <option value="both">Show both (Base + Device)</option>
            </select>
          </div>
          <div>
            <label htmlFor="time_format" className="block text-sm font-medium text-slate-300">
              Time format
            </label>
            <select
              id="time_format"
              name="time_format"
              defaultValue={timeFormat}
              className="profile-select mt-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 [&>option]:bg-slate-900 [&>option]:text-slate-200"
            >
              <option value="24h">24-hour (default)</option>
              <option value="12h">12-hour</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="show_timezone_label"
              name="show_timezone_label"
              type="checkbox"
              defaultChecked={showTimezoneLabel}
              value="1"
              className="h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50"
            />
            <input type="hidden" name="show_timezone_label" value="0" />
            <label htmlFor="show_timezone_label" className="text-sm text-slate-300">
              Show timezone label next to times <span className="text-slate-500">(e.g., 2230 SJU)</span>
            </label>
          </div>
        </div>
      </section>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#75C043] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
