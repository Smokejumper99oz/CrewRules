"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateProfilePreferences } from "@/app/frontier/pilots/portal/profile/actions";
import { SettingsProfilePreserveFields } from "@/components/settings-profile-preserve-fields";
import { useSettingsAutoSave } from "@/hooks/use-settings-auto-save";
import { DEFAULT_TIMEZONE } from "@/lib/airport-timezone";
import type { Profile } from "@/lib/profile";
import { FamilyViewInvitesInternalTestPanel } from "@/components/family-view-invites-internal-test-panel";
import { FamilyViewInvitesPanel } from "@/components/family-view-invites-panel";

const FAMILY_VIEW_FIELD_KEYS = {
  family_view_enabled: "family_view_enabled",
  family_view_show_exact_times: "family_view_show_exact_times",
  family_view_show_overnight_cities: "family_view_show_overnight_cities",
  family_view_show_commute_estimates: "family_view_show_commute_estimates",
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

/** Matches Commute Assist settings: switch row + `type="checkbox"` + hidden `0` parity when Pro. */
function FamilyViewToggleRow({
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
      <input type="hidden" name="home_airport" value={profile.home_airport ?? ""} />
      <input type="hidden" name="alternate_home_airport" value={profile.alternate_home_airport ?? ""} />
    </div>
  );
}

type Props = {
  profile: Profile;
  proActive: boolean;
  /** Dev / explicit server env only; see settings/family-view/page.tsx */
  showInternalInviteTestPanel?: boolean;
};

export function FamilyViewSettingsForm({ profile, proActive, showInternalInviteTestPanel }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  const familyEnabled = Boolean(profile.family_view_enabled);
  const showExact = profile.family_view_show_exact_times !== false;
  const showOvernight = profile.family_view_show_overnight_cities !== false;
  const showCommuteEst = profile.family_view_show_commute_estimates !== false;
  const yn = (b: boolean) => (b ? "1" : "0");

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

  const { status, errorMessage, saveNow } = useSettingsAutoSave(formRef, saveFn, onSaveSuccess);

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
            Family View<span className="align-super text-[10px]">™</span>
          </h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            What your shared or family-facing schedule shows and how it behaves.
          </p>
        </div>
      </div>
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-8">
        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="family-view-settings-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="family-view-settings-heading"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Sharing
            </h3>
            <p className="mt-2 text-pretty text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Control what your family can see when viewing your schedule. You can keep it simple or share more
              detailed information depending on your preference.
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {!proActive && (
              <p className="text-xs leading-relaxed text-amber-400">
                🔒 Available with CrewRules™ Pro — start your free 14-day trial to unlock these options.
              </p>
            )}
            <FamilyViewToggleRow
              id="settings_family_view_enabled"
              name="family_view_enabled"
              reactKey={`fv-en-${familyEnabled}`}
              defaultOn={familyEnabled}
              disabled={!proActive}
              proActive={proActive}
              onChange={() => {
                setFeedbackTargetKey(FAMILY_VIEW_FIELD_KEYS.family_view_enabled);
                immediateSave();
              }}
              label="Enable Family View"
              feedbackFieldKey={FAMILY_VIEW_FIELD_KEYS.family_view_enabled}
              feedback={settingsFieldFeedback}
            >
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Share schedule visibility with family or trusted viewers.
              </p>
            </FamilyViewToggleRow>
            <FamilyViewToggleRow
              id="settings_family_view_show_exact_times"
              name="family_view_show_exact_times"
              reactKey={`fv-et-${showExact}`}
              defaultOn={showExact}
              disabled={!proActive}
              proActive={proActive}
              onChange={() => {
                setFeedbackTargetKey(FAMILY_VIEW_FIELD_KEYS.family_view_show_exact_times);
                immediateSave();
              }}
              label="Show exact times"
              feedbackFieldKey={FAMILY_VIEW_FIELD_KEYS.family_view_show_exact_times}
              feedback={settingsFieldFeedback}
            >
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Displays your report and release times so your family knows exactly when you&apos;re working. Turn this
                off to keep timing more private.
              </p>
            </FamilyViewToggleRow>
            <FamilyViewToggleRow
              id="settings_family_view_show_overnight_cities"
              name="family_view_show_overnight_cities"
              reactKey={`fv-oc-${showOvernight}`}
              defaultOn={showOvernight}
              disabled={!proActive}
              proActive={proActive}
              onChange={() => {
                setFeedbackTargetKey(FAMILY_VIEW_FIELD_KEYS.family_view_show_overnight_cities);
                immediateSave();
              }}
              label="Show overnight cities"
              feedbackFieldKey={FAMILY_VIEW_FIELD_KEYS.family_view_show_overnight_cities}
              feedback={settingsFieldFeedback}
            >
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Shows the cities where you&apos;ll be staying overnight. Helpful for family to know where you are during
                trips.
              </p>
            </FamilyViewToggleRow>
            <FamilyViewToggleRow
              id="settings_family_view_show_commute_estimates"
              name="family_view_show_commute_estimates"
              reactKey={`fv-ce-${showCommuteEst}`}
              defaultOn={showCommuteEst}
              disabled={!proActive}
              proActive={proActive}
              onChange={() => {
                setFeedbackTargetKey(FAMILY_VIEW_FIELD_KEYS.family_view_show_commute_estimates);
                immediateSave();
              }}
              label="Show commute estimates"
              feedbackFieldKey={FAMILY_VIEW_FIELD_KEYS.family_view_show_commute_estimates}
              feedback={settingsFieldFeedback}
            >
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Adds simple indicators like &ldquo;Likely commuting&rdquo; to help your family understand travel days.
                This is an estimate, not a confirmed commute.
              </p>
            </FamilyViewToggleRow>
          </div>
        </section>

        {!proActive && (
          <div className="hidden" aria-hidden>
            <input type="hidden" name="family_view_enabled" value={yn(familyEnabled)} />
            <input type="hidden" name="family_view_show_exact_times" value={yn(showExact)} />
            <input type="hidden" name="family_view_show_overnight_cities" value={yn(showOvernight)} />
            <input type="hidden" name="family_view_show_commute_estimates" value={yn(showCommuteEst)} />
          </div>
        )}

        <PilotPersonalFieldsPreserve profile={profile} />
        <SettingsProfilePreserveFields profile={profile} omitFamilyViewFields />
      </form>

      <section
        className="mt-8 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
        aria-labelledby="family-view-viewers-heading"
      >
        <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
          <h3
            id="family-view-viewers-heading"
            className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Viewers
          </h3>
        </div>
        <div className="mt-4">
          <FamilyViewInvitesPanel proActive={proActive} />
        </div>
      </section>

      {showInternalInviteTestPanel ? <FamilyViewInvitesInternalTestPanel /> : null}
    </div>
  );
}
