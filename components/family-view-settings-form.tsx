"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Mail, Users } from "lucide-react";
import { updateProfilePreferences } from "@/app/frontier/pilots/portal/profile/actions";
import { SettingsProfilePreserveFields } from "@/components/settings-profile-preserve-fields";
import { useSettingsAutoSave } from "@/hooks/use-settings-auto-save";
import { DEFAULT_TIMEZONE } from "@/lib/airport-timezone";
import type { Profile } from "@/lib/profile";

const FAMILY_VIEW_FIELD_KEYS = {
  family_view_enabled: "family_view_enabled",
  family_view_show_exact_times: "family_view_show_exact_times",
  family_view_show_overnight_cities: "family_view_show_overnight_cities",
  family_view_show_commute_estimates: "family_view_show_commute_estimates",
} as const;

/**
 * Reads viewer email fields if present on the raw `profiles` row (`select("*")`).
 * There is no dedicated column in current migrations; the list is usually empty until backend adds storage.
 */
function familyViewSharedViewerEmailsFromProfile(profile: Profile): string[] {
  const row = profile as unknown as Record<string, unknown>;
  const gather = (v: unknown): string[] => {
    if (typeof v === "string") {
      const t = v.trim();
      return t.includes("@") ? [t] : [];
    }
    if (Array.isArray(v)) {
      return v
        .filter((x): x is string => typeof x === "string" && x.includes("@"))
        .map((x) => x.trim());
    }
    return [];
  };
  const keys = [
    "family_view_invited_emails",
    "family_view_shared_emails",
    "family_view_viewer_emails",
  ] as const;
  const emails: string[] = [];
  for (const k of keys) {
    emails.push(...gather(row[k]));
  }
  return [...new Set(emails)];
}

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
};

export function FamilyViewSettingsForm({ profile, proActive }: Props) {
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

  const sharedViewerEmails = familyViewSharedViewerEmailsFromProfile(profile);

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
        <div className="mt-4 space-y-6">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Anyone you&apos;ve approved for Family View will be listed here once invitations are available.
          </p>

          {sharedViewerEmails.length === 0 ? (
            <div className="flex gap-4 rounded-xl border border-slate-200/80 bg-white/75 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:px-5 sm:py-5 dark:border-white/10 dark:bg-slate-900/35 dark:shadow-none">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] dark:bg-slate-800/90 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]"
                aria-hidden
              >
                <Users className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">No shared viewers yet</p>
                <p className="mt-1.5 text-pretty text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  You don&apos;t have any invited viewers on file. When invites go live, each person you add will appear in
                  this list so you know who can see your schedule.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {sharedViewerEmails.map((email) => (
                <li
                  key={email}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-3 text-sm text-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-200 dark:shadow-none [overflow-wrap:anywhere]"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                  <span>{email}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white/90 via-slate-50/50 to-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-5 dark:border-white/10 dark:from-slate-900/50 dark:via-slate-950/40 dark:to-slate-950/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Add a family member</h4>
              <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
                Coming next
              </span>
            </div>
            <p className="mt-2 max-w-prose text-pretty text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Email invitations are on the roadmap. The layout below is a non-interactive preview: nothing is sent and
              nothing is saved.
            </p>
            <div className="mt-5 space-y-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</span>
              <div
                className="rounded-lg border border-dashed border-slate-300/80 bg-white/70 px-3 py-3 text-sm text-slate-400 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-500"
                aria-hidden
              >
                <span className="select-none">Enter an email to invite</span>
              </div>
            </div>
            <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-100/90 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed opacity-80 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-500"
              >
                Invite Family Member
              </button>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Preview only · not available yet
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
