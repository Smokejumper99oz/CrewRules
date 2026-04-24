"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DatePickerInput } from "@/components/date-picker-input";
import { CustomFormSelect } from "@/components/custom-form-select";
import {
  FRONTIER_CREW_BASE_VALUES,
  FRONTIER_CREW_BASE_OPTIONS,
  getFrontierCrewBaseLabel,
} from "@/lib/frontier-crew-bases";
import { getTimezoneFromAirport, DEFAULT_TIMEZONE } from "@/lib/airport-timezone";
import type { Profile } from "@/lib/profile";
import { isEligibleForProTrialStartCta } from "@/lib/profile-helpers";

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

const FRONTIER_CREW_BASE_CANONICAL = new Set(FRONTIER_CREW_BASE_VALUES);

/** UI-only default for Equipment when Frontier pilot has no saved value (not written until user saves). */
const FRONTIER_TENANT = "frontier";
const FRONTIER_EQUIPMENT_UI_DEFAULT = "A320/A321";

const PROFILE_POSITION_OPTIONS = [
  { value: "captain", label: "Captain" },
  { value: "first_officer", label: "First Officer" },
  { value: "flight_attendant", label: "Flight Attendant" },
] as const;

const PROFILE_ROLE_OPTIONS = [
  { value: "", label: "Select role" },
  ...PROFILE_POSITION_OPTIONS,
] as const;

/**
 * Lighter, settings-style controls for this component only (does not alter global profile-input-base).
 * h-10 + py-2, softer dark fill/border, brand focus ring without heavy box.
 */
const PILOT_FIELD_CONTROL =
  "box-border h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-400 " +
  "focus:border-[#75C043] focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 " +
  "dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500";

const PILOT_NATIVE_SELECT_CONTROL = `${PILOT_FIELD_CONTROL} cursor-pointer`;

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

/** Keys used for Settings > Pilot field-local auto-save feedback (not used on Profile page). */
export const PILOT_SETTINGS_FIELD_FEEDBACK_KEYS = {
  full_name: "full_name",
  employee_number: "employee_number",
  role: "role",
  crew_base: "crew_base",
  date_of_hire: "date_of_hire",
  equipment: "equipment",
} as const;

export type PilotSettingsFieldFeedbackKey =
  (typeof PILOT_SETTINGS_FIELD_FEEDBACK_KEYS)[keyof typeof PILOT_SETTINGS_FIELD_FEEDBACK_KEYS];

export type PilotSettingsFieldFeedback = {
  activeKey: string | null;
  status: "idle" | "saving" | "saved" | "error";
  errorMessage: string | null;
};

function FieldSaveFeedback({
  fieldKey,
  feedback,
}: {
  fieldKey: string;
  feedback: PilotSettingsFieldFeedback | undefined;
}) {
  if (!feedback || feedback.activeKey !== fieldKey || feedback.status === "idle") return null;
  return (
    <p className="mt-1.5 text-xs font-medium tracking-wide transition-opacity duration-300" aria-live="polite">
      {feedback.status === "saving" && (
        <span className="text-slate-500 tabular-nums dark:text-slate-400">Saving…</span>
      )}
      {feedback.status === "saved" && (
        <span className="text-emerald-600/90 dark:text-emerald-400/90">Saved</span>
      )}
      {feedback.status === "error" && (
        <span
          className="cursor-default text-red-600/90 dark:text-red-400/90"
          title={feedback.errorMessage ?? "Couldn’t save"}
        >
          Couldn&apos;t save
        </span>
      )}
    </p>
  );
}

export type PilotProfilePersonalFieldsModel = {
  tenant?: string;
  portal?: string;
  full_name?: string | null;
  employee_number?: string | null;
  date_of_hire?: string | null;
  position?: "captain" | "first_officer" | "flight_attendant" | null;
  base_airport?: string | null;
  equipment?: string | null;
  base_timezone?: string;
  home_airport?: string | null;
  alternate_home_airport?: string | null;
};

type Props = {
  profile: PilotProfilePersonalFieldsModel;
  proActive: boolean;
  saving: boolean;
  /** Settings > Pilot: debounced auto-save for text fields */
  onTextEdit?: () => void;
  /** Settings > Pilot: immediate auto-save (selects, committed date, timezone toggle) */
  onImmediateCommit?: () => void;
  /** Settings > Pilot: which field group last triggered a save (for local feedback) */
  onSettingsFieldTouched?: (key: PilotSettingsFieldFeedbackKey) => void;
  /** Settings > Pilot: auto-save status scoped to {@link onSettingsFieldTouched} key */
  settingsFieldFeedback?: PilotSettingsFieldFeedback;
  /**
   * Settings > Pilot: cap every control width to the DOH field (`max-w-[12rem]`).
   * Omit on Profile so legacy widths stay unchanged.
   */
  capFieldsToDohWidth?: boolean;
  /**
   * Settings > Pilot: hide Home / Alternate (owned on Settings → Commute Assist). Omit on Profile.
   * When true, parent form must still submit these via hidden inputs.
   */
  hideHomeAirportFields?: boolean;
};

export function PilotProfilePersonalFields({
  profile,
  proActive,
  saving,
  onTextEdit,
  onImmediateCommit,
  onSettingsFieldTouched,
  settingsFieldFeedback,
  capFieldsToDohWidth = false,
  hideHomeAirportFields = false,
}: Props) {
  const maxWide = capFieldsToDohWidth ? "max-w-[12rem]" : "max-w-sm";
  const maxCompact = capFieldsToDohWidth ? "max-w-[12rem]" : "max-w-[8rem]";

  const [baseAirport, setBaseAirport] = useState(profile.base_airport ?? "");
  const [position, setPosition] = useState(() => profile.position ?? "");
  const storedTimezone = profile.base_timezone ?? DEFAULT_TIMEZONE;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualTimezone, setManualTimezone] = useState(storedTimezone);

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

  useEffect(() => {
    setPosition(profile.position ?? "");
  }, [profile.position]);

  useEffect(() => {
    setBaseAirport(profile.base_airport ?? "");
  }, [profile.base_airport]);

  const handleValidIsoCommit = useCallback(() => {
    onImmediateCommit?.();
    onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.date_of_hire);
  }, [onImmediateCommit, onSettingsFieldTouched]);

  const sortedCrewBaseOptions = useMemo(() => {
    const list = [...FRONTIER_CREW_BASE_OPTIONS];
    if (baseAirport && !FRONTIER_CREW_BASE_CANONICAL.has(baseAirport)) {
      list.push({ value: baseAirport, label: getFrontierCrewBaseLabel(baseAirport) });
    }
    list.sort((a, b) => a.value.localeCompare(b.value));
    return [{ value: "", label: "Select crew base" }, ...list];
  }, [baseAirport]);

  const equipmentInputDefault = useMemo(() => {
    const saved = profile.equipment?.trim() ?? "";
    if (saved.length > 0) return saved;
    if (profile.tenant === FRONTIER_TENANT) return FRONTIER_EQUIPMENT_UI_DEFAULT;
    return "";
  }, [profile.equipment, profile.tenant]);

  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Personal Information</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Full Name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={profile.full_name ?? ""}
            placeholder="e.g. Jane Smith"
            className={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxWide}`}
            onInput={() => {
              onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.full_name);
              onTextEdit?.();
            }}
          />
          <FieldSaveFeedback
            fieldKey={PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.full_name}
            feedback={settingsFieldFeedback}
          />
        </div>
        <div>
          <label htmlFor="employee_number" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Employee Number
          </label>
          <input
            id="employee_number"
            name="employee_number"
            type="text"
            defaultValue={profile.employee_number ?? ""}
            placeholder="e.g. 12345"
            className={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxWide}`}
            onInput={() => {
              onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.employee_number);
              onTextEdit?.();
            }}
          />
          <FieldSaveFeedback
            fieldKey={PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.employee_number}
            feedback={settingsFieldFeedback}
          />
          <p className="mt-1 text-xs text-slate-500">
            Employee Number is used for internal portal identification and to enable pilot matching in the CrewRules™
            Mentorship Program.
          </p>
        </div>
        <div>
          <label htmlFor="date_of_hire" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Date of Hire (DOH)
          </label>
          <DatePickerInput
            id="date_of_hire"
            name="date_of_hire"
            value={profile.date_of_hire ?? undefined}
            placeholder="mm/dd/yyyy or mm/dd/yy"
            strictFullDateEntry={Boolean(onTextEdit)}
            className={`${PILOT_FIELD_CONTROL} mt-1.5 w-full max-w-[12rem] cursor-pointer`}
            onDisplayInput={
              onTextEdit
                ? () => {
                    onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.date_of_hire);
                    onTextEdit();
                  }
                : undefined
            }
            onValidIsoCommit={onImmediateCommit ? handleValidIsoCommit : undefined}
          />
          <FieldSaveFeedback
            fieldKey={PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.date_of_hire}
            feedback={settingsFieldFeedback}
          />
          <p className="mt-1 text-xs text-slate-500">
            Used for internal calculations such as anniversary badges and CrewRules™ Pro pay calculations. Your information
            is never shared.
          </p>
        </div>
        {/* Assignment cluster: Role → Crew Base → derived timezone (tighter rhythm than global form spacing). */}
        <div className="space-y-2.5">
          <div>
            <label htmlFor="position" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Role
            </label>
            <CustomFormSelect
              id="position"
              name="position"
              options={PROFILE_ROLE_OPTIONS}
              placeholder="Select role"
              menuVariant="settings"
              disabled={saving}
              value={position}
              onValueChange={(v) => {
                setPosition(v);
                onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.role);
                onTextEdit?.();
              }}
              triggerClassName={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxWide}`}
              containerClassName={maxWide}
            />
            <FieldSaveFeedback
              fieldKey={PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.role}
              feedback={settingsFieldFeedback}
            />
          </div>
          <div>
            <label htmlFor="base_airport" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Crew Base
            </label>
            <CustomFormSelect
              id="base_airport"
              name="base_airport"
              options={sortedCrewBaseOptions}
              placeholder="Select crew base"
              menuVariant="settings"
              disabled={saving}
              value={baseAirport}
              onValueChange={(v) => {
                setBaseAirport(v);
                onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.crew_base);
                onTextEdit?.();
              }}
              triggerClassName={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxCompact}`}
              containerClassName={maxCompact}
            />
            <FieldSaveFeedback
              fieldKey={PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.crew_base}
              feedback={settingsFieldFeedback}
            />
            <p className="mt-1 text-xs text-slate-500">
              3-letter IATA airport code. Used for reserve calculations and default commute planning. If a trip starts from
              another airport, Commute Assist
              <span className="align-super text-[10px]">™</span> automatically uses that airport instead.
            </p>
          </div>
          <div className="border-t border-slate-200/60 pt-2.5 dark:border-white/[0.08]">
            <p className="text-sm text-slate-400">
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
                onTextEdit?.();
              }}
              className="mt-1.5 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300"
            >
              {showAdvanced ? "Hide advanced" : "Advanced"}
            </button>
            {showAdvanced && (
              <div className="mt-2.5">
                <label
                  htmlFor="base_timezone_override"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Override crew base timezone
                </label>
                <select
                  id="base_timezone_override"
                  value={manualTimezone}
                  onChange={(e) => {
                    setManualTimezone(e.target.value);
                    onTextEdit?.();
                  }}
                  className={`${PILOT_NATIVE_SELECT_CONTROL} mt-1.5 w-full ${maxWide}`}
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
        </div>
        {!hideHomeAirportFields && (
          <>
            <div>
              <label htmlFor="home_airport" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Home Airport
              </label>
              <input
                id="home_airport"
                name="home_airport"
                type="text"
                defaultValue={profile.home_airport ?? ""}
                maxLength={3}
                placeholder="e.g. MCO"
                disabled={!proActive}
                readOnly={!proActive}
                className={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxCompact} uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
                style={{ textTransform: "uppercase" }}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.toUpperCase();
                  onTextEdit?.();
                }}
              />
              <p className="mt-1 text-xs text-slate-500">3-letter IATA code. This is where your commute normally begins.</p>
              {!proActive &&
                isEligibleForProTrialStartCta(profile as Profile) &&
                profile.tenant &&
                profile.portal && (
                  <Link
                    href={`/${profile.tenant}/${profile.portal}/portal/settings/subscription`}
                    className="mt-1 inline-block text-xs text-[#75C043] hover:underline"
                  >
                    Start your free 14-day trial
                  </Link>
                )}
            </div>
            <div>
              <label htmlFor="alternate_home_airport" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Alternate Home Airport <span className="font-normal text-slate-500">(Optional)</span>
              </label>
              <input
                id="alternate_home_airport"
                name="alternate_home_airport"
                type="text"
                defaultValue={profile.alternate_home_airport ?? ""}
                maxLength={3}
                placeholder="e.g. MCO"
                disabled={!proActive}
                readOnly={!proActive}
                className={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxCompact} uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
                style={{ textTransform: "uppercase" }}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.toUpperCase();
                  onTextEdit?.();
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                Backup home airport used when flights from your primary home airport are limited.
              </p>
            </div>
          </>
        )}
        <div>
          <label htmlFor="equipment" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Equipment
          </label>
          <input
            id="equipment"
            name="equipment"
            type="text"
            defaultValue={equipmentInputDefault}
            placeholder="e.g. A320, A321"
            className={`${PILOT_FIELD_CONTROL} mt-1.5 w-full ${maxWide}`}
            onInput={() => {
              onSettingsFieldTouched?.(PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.equipment);
              onTextEdit?.();
            }}
          />
          <FieldSaveFeedback
            fieldKey={PILOT_SETTINGS_FIELD_FEEDBACK_KEYS.equipment}
            feedback={settingsFieldFeedback}
          />
        </div>
      </div>
    </section>
  );
}
