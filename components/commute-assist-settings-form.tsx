"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProfilePreferences } from "@/app/frontier/pilots/portal/profile/actions";
import { SettingsProfilePreserveFields } from "@/components/settings-profile-preserve-fields";
import { useSettingsAutoSave } from "@/hooks/use-settings-auto-save";
import { DEFAULT_TIMEZONE } from "@/lib/airport-timezone";
import type { Profile } from "@/lib/profile";
import { isEligibleForProTrialStartCta } from "@/lib/profile-helpers";

/** Same option set as Profile “Commute Assist” → Direct Flights. */
const COMMUTE_BUFFER_OPTIONS = [30, 60, 90, 120, 180] as const;

const FIELD_CONTROL =
  "box-border h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-400 " +
  "focus:border-[#75C043] focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 " +
  "dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500";

const NATIVE_SELECT = `${FIELD_CONTROL} cursor-pointer`;

const FIELD_MAX = "max-w-[12rem]";

const COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS = {
  home_airport: "home_airport",
  alternate_home_airport: "alternate_home_airport",
  commute_arrival_buffer_minutes: "commute_arrival_buffer_minutes",
  commute_two_leg_stop_1: "commute_two_leg_stop_1",
  commute_two_leg_stop_2: "commute_two_leg_stop_2",
  commute_two_leg_enabled: "commute_two_leg_enabled",
  commute_nonstop_only: "commute_nonstop_only",
  personal_email: "personal_email",
} as const;

type FieldFeedback = {
  activeKey: string | null;
  status: "idle" | "saving" | "saved" | "error";
  errorMessage: string | null;
};

function FieldSaveFeedback({
  fieldKey,
  feedback,
}: {
  fieldKey: string;
  feedback: FieldFeedback | undefined;
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

/** Switch-style row; real control remains `type="checkbox"` + hidden `0` parity for `updateProfilePreferences`. */
function CommuteSettingsToggleRow({
  id,
  name,
  reactKey,
  defaultOn,
  disabled,
  proActive,
  onChange,
  label,
  feedbackFieldKey,
  feedback,
  children,
}: {
  id: string;
  name: string;
  reactKey: string;
  defaultOn: boolean;
  disabled: boolean;
  proActive: boolean;
  onChange: () => void;
  label: string;
  feedbackFieldKey: string;
  feedback: FieldFeedback | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="py-0.5">
      <div className="flex flex-col gap-1.5">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <label
            htmlFor={id}
            className="min-w-0 flex-1 cursor-pointer text-sm font-medium leading-snug text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
          <div className="relative h-6 w-10 shrink-0">
            <input
              id={id}
              name={name}
              type="checkbox"
              value="1"
              key={reactKey}
              defaultChecked={defaultOn}
              disabled={disabled}
              onChange={() => {
                onChange();
              }}
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span
              className="pointer-events-none absolute inset-0 rounded-full bg-slate-300/85 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.07)] transition-colors duration-200 peer-checked:bg-[#75C043] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#75C043]/35 dark:bg-slate-600 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] peer-checked:dark:bg-[#75C043] dark:peer-focus-visible:outline-emerald-400/35 peer-disabled:opacity-50"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute left-[2px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_0.5px_2px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out peer-checked:translate-x-5 dark:bg-slate-100"
              aria-hidden
            />
          </div>
          {proActive && <input type="hidden" name={name} value="0" />}
        </div>
        <FieldSaveFeedback fieldKey={feedbackFieldKey} feedback={feedback} />
        {children}
      </div>
    </div>
  );
}

/** Hidden snapshot of pilot-personal fields edited on Settings > Pilot so this save does not clear them. */
function PilotPersonalFieldsPreserve({ profile }: { profile: Profile }) {
  const baseTz = profile.base_timezone?.trim() || DEFAULT_TIMEZONE;
  return (
    <div className="hidden" aria-hidden>
      <input type="hidden" name="full_name" value={profile.full_name ?? ""} />
      <input type="hidden" name="employee_number" value={profile.employee_number ?? ""} />
      <input type="hidden" name="date_of_hire" value={profile.date_of_hire ?? ""} />
      <input type="hidden" name="position" value={profile.position ?? ""} />
      <input type="hidden" name="base_airport" value={profile.base_airport ?? ""} />
      <input type="hidden" name="equipment" value={profile.equipment ?? ""} />
      <input type="hidden" name="base_timezone" value={baseTz} />
    </div>
  );
}

type Props = {
  profile: Profile;
  proActive: boolean;
};

export function CommuteAssistSettingsForm({ profile, proActive }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const homeAirport = profile.home_airport ?? "";
  const alternateHomeAirport = profile.alternate_home_airport ?? "";
  const commuteArrival = profile.commute_arrival_buffer_minutes ?? 60;
  const commuteTwoLegEnabled = profile.commute_two_leg_enabled ?? false;
  const commuteTwoLegStop1 = profile.commute_two_leg_stop_1 ?? "";
  const commuteTwoLegStop2 = profile.commute_two_leg_stop_2 ?? "";
  /** Trial / read-only snapshot: unchanged from prior behavior (DB default true, explicit false off). */
  const commuteNonstopOnly = profile.commute_nonstop_only !== false;
  const commuteAlertEmail = profile.personal_email ?? "";

  const saveFn = useCallback(async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const result = await updateProfilePreferences(formData);
    if ("error" in result) {
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const };
  }, []);

  const onSaveSuccess = useCallback(() => {
    setTimeout(() => {
      router.refresh();
    }, 0);
  }, [router]);

  const { status, errorMessage, scheduleDebouncedSave, saveNow } = useSettingsAutoSave(
    formRef,
    saveFn,
    onSaveSuccess,
  );

  const [feedbackTargetKey, setFeedbackTargetKey] = useState<string | null>(null);

  useEffect(() => {
    if (status === "idle") {
      setFeedbackTargetKey(null);
    }
  }, [status]);

  const immediateSave = useCallback(() => {
    queueMicrotask(() => saveNow());
  }, [saveNow]);

  const settingsFieldFeedback: FieldFeedback = {
    activeKey: feedbackTargetKey,
    status,
    errorMessage,
  };

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">
            Commute{" "}
            <span className="text-[#75C043]">Assist</span>
            <span className="align-super text-[10px]">™</span>
          </h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            Home base, commute filters, and related assist options.
          </p>
        </div>
      </div>
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-8">
        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="commute-settings-alert-email-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="commute-settings-alert-email-heading"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Commute{" "}
              <span className="text-[#75C043]">Assist</span>
              <span className="align-super text-[10px]">™</span>{" "}
              Alert email
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Use a personal email where you receive phone notifications.
            </p>
            <input
              id="commute_alert_personal_email"
              name="personal_email"
              type="email"
              autoComplete="email"
              aria-labelledby="commute-settings-alert-email-heading"
              key={commuteAlertEmail}
              defaultValue={commuteAlertEmail}
              placeholder="you@example.com"
              disabled={!proActive}
              readOnly={!proActive}
              className={`${FIELD_CONTROL} w-full max-w-md disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
              onInput={() => {
                setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.personal_email);
                scheduleDebouncedSave();
              }}
            />
            <FieldSaveFeedback
              fieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.personal_email}
              feedback={settingsFieldFeedback}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              CrewRules<span className="align-super text-[9px]">™</span> will send commute alerts to this email first.
              If blank, alerts go to your account email.
            </p>
          </div>
        </section>

        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="commute-settings-origins-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="commute-settings-origins-heading"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Commute Origins
            </h3>
          </div>
          <div className="mt-4 space-y-4">
          <CommuteSettingsToggleRow
            id="settings_commute_nonstop_only"
            name="commute_nonstop_only"
            reactKey={`nonstop-${commuteNonstopOnly}`}
            defaultOn={commuteNonstopOnly}
            disabled={!proActive}
            proActive={proActive}
            onChange={() => {
              setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_nonstop_only);
              immediateSave();
            }}
            label="Direct Flights Only"
            feedbackFieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_nonstop_only}
            feedback={settingsFieldFeedback}
          >
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Show nonstop commute options first.
            </p>
          </CommuteSettingsToggleRow>
          <div>
            <label htmlFor="commute_home_airport" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Home Airport
            </label>
            <input
              id="commute_home_airport"
              name="home_airport"
              type="text"
              key={homeAirport}
              defaultValue={homeAirport}
              maxLength={3}
              placeholder="e.g. MCO"
              disabled={!proActive}
              readOnly={!proActive}
              className={`${FIELD_CONTROL} mt-1.5 w-full ${FIELD_MAX} uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
              style={{ textTransform: "uppercase" }}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
                setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.home_airport);
                scheduleDebouncedSave();
              }}
            />
            <FieldSaveFeedback
              fieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.home_airport}
              feedback={settingsFieldFeedback}
            />
            <p className="mt-1 text-xs text-slate-500">3-letter IATA code. This is where your commute normally begins.</p>
            {!proActive && isEligibleForProTrialStartCta(profile) && (
              <Link
                href={`/${profile.tenant}/${profile.portal}/portal/settings/subscription`}
                className="mt-1 inline-block text-xs text-[#75C043] hover:underline"
              >
                View Pro trial →
              </Link>
            )}
          </div>
          <div>
            <label
              htmlFor="commute_alternate_home_airport"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Alternate Home Airport <span className="font-normal text-slate-500">(Optional)</span>
            </label>
            <input
              id="commute_alternate_home_airport"
              name="alternate_home_airport"
              type="text"
              key={alternateHomeAirport}
              defaultValue={alternateHomeAirport}
              maxLength={3}
              placeholder="e.g. MCO"
              disabled={!proActive}
              readOnly={!proActive}
              className={`${FIELD_CONTROL} mt-1.5 w-full ${FIELD_MAX} uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
              style={{ textTransform: "uppercase" }}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
                setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.alternate_home_airport);
                scheduleDebouncedSave();
              }}
            />
            <FieldSaveFeedback
              fieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.alternate_home_airport}
              feedback={settingsFieldFeedback}
            />
            <p className="mt-1 text-xs text-slate-500">
              Backup home airport used when flights from your primary home airport are limited.
            </p>
          </div>
          </div>
        </section>

        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="commute-settings-direct-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="commute-settings-direct-heading"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Arrival Timing
            </h3>
          </div>
          <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="settings_commute_arrival_buffer_minutes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Arrival Buffer Before Duty
            </label>
            <select
              id="settings_commute_arrival_buffer_minutes"
              name="commute_arrival_buffer_minutes"
              key={`arr-${commuteArrival}`}
              defaultValue={commuteArrival}
              disabled={!proActive}
              onChange={() => {
                setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_arrival_buffer_minutes);
                immediateSave();
              }}
              className={`${NATIVE_SELECT} mt-1.5 w-full ${FIELD_MAX} disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "opacity-60" : ""}`}
            >
              {COMMUTE_BUFFER_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
            <FieldSaveFeedback
              fieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_arrival_buffer_minutes}
              feedback={settingsFieldFeedback}
            />
            <p className="mt-1 text-xs text-slate-500">
              Minimum time you want to arrive before your report time. Used for commute safety calculations.
            </p>
          </div>
          {/* Match Profile commute card: fixed release for this product path */}
          <input type="hidden" name="commute_release_buffer_minutes" value="0" />
          </div>
        </section>

        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="commute-settings-2leg-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="commute-settings-2leg-heading"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              <span>2-Leg Options</span>
              <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-200">
                IN DEVELOPMENT
              </span>
            </h3>
          </div>
          <div className="mt-4 space-y-4">
          <CommuteSettingsToggleRow
            id="settings_commute_two_leg_enabled"
            name="commute_two_leg_enabled"
            reactKey={`2leg-${commuteTwoLegEnabled}`}
            defaultOn={commuteTwoLegEnabled}
            disabled={!proActive}
            proActive={proActive}
            onChange={() => {
              setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_two_leg_enabled);
              immediateSave();
            }}
            label="Enable 2-Leg Search"
            feedbackFieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_two_leg_enabled}
            feedback={settingsFieldFeedback}
          >
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Used when no direct flight exists. Example: SAV → ATL → SJU or SAV → CLT → SJU.
            </p>
          </CommuteSettingsToggleRow>
          <div>
            <label
              htmlFor="settings_commute_two_leg_stop_1"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Connection Airport 1
            </label>
            <input
              id="settings_commute_two_leg_stop_1"
              name="commute_two_leg_stop_1"
              type="text"
              key={commuteTwoLegStop1}
              defaultValue={commuteTwoLegStop1}
              maxLength={3}
              placeholder="e.g. ATL"
              disabled={!proActive}
              readOnly={!proActive}
              className={`${FIELD_CONTROL} mt-1.5 w-full ${FIELD_MAX} uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
              style={{ textTransform: "uppercase" }}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
                setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_two_leg_stop_1);
                scheduleDebouncedSave();
              }}
            />
            <FieldSaveFeedback
              fieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_two_leg_stop_1}
              feedback={settingsFieldFeedback}
            />
          </div>
          <div>
            <label
              htmlFor="settings_commute_two_leg_stop_2"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Connection Airport 2
            </label>
            <input
              id="settings_commute_two_leg_stop_2"
              name="commute_two_leg_stop_2"
              type="text"
              key={commuteTwoLegStop2}
              defaultValue={commuteTwoLegStop2}
              maxLength={3}
              placeholder="e.g. MCO"
              disabled={!proActive}
              readOnly={!proActive}
              className={`${FIELD_CONTROL} mt-1.5 w-full ${FIELD_MAX} uppercase placeholder:normal-case disabled:cursor-not-allowed disabled:opacity-70 ${!proActive ? "cursor-not-allowed opacity-60" : ""}`}
              style={{ textTransform: "uppercase" }}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
                setFeedbackTargetKey(COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_two_leg_stop_2);
                scheduleDebouncedSave();
              }}
            />
            <FieldSaveFeedback
              fieldKey={COMMUTE_SETTINGS_FIELD_FEEDBACK_KEYS.commute_two_leg_stop_2}
              feedback={settingsFieldFeedback}
            />
          </div>
          </div>
        </section>

        {!proActive && (
          <div className="hidden" aria-hidden>
            <input type="hidden" name="home_airport" value={homeAirport} />
            <input type="hidden" name="alternate_home_airport" value={alternateHomeAirport} />
            <input type="hidden" name="commute_arrival_buffer_minutes" value={String(commuteArrival)} />
            <input type="hidden" name="commute_nonstop_only" value={commuteNonstopOnly ? "1" : "0"} />
            <input type="hidden" name="commute_two_leg_enabled" value={commuteTwoLegEnabled ? "1" : "0"} />
            <input type="hidden" name="commute_two_leg_stop_1" value={commuteTwoLegStop1} />
            <input type="hidden" name="commute_two_leg_stop_2" value={commuteTwoLegStop2} />
            <input type="hidden" name="personal_email" value={commuteAlertEmail} />
          </div>
        )}

        <PilotPersonalFieldsPreserve profile={profile} />
        <SettingsProfilePreserveFields profile={profile} omitCommutePlanningFields />
      </form>
    </div>
  );
}
