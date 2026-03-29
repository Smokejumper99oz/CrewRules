"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { updateProfilePreferences } from "@/app/frontier/pilots/portal/profile/actions";
import { SettingsProfilePreserveFields } from "@/components/settings-profile-preserve-fields";
import { useSettingsAutoSave } from "@/hooks/use-settings-auto-save";
import { DEFAULT_TIMEZONE } from "@/lib/airport-timezone";
import { isMentorForAccountRoleBadges } from "@/lib/account-role-display";
import { formatUsPhoneDisplay } from "@/lib/format-us-phone";
import { isWithinFirstYearSinceDateOfHire } from "@/lib/profile-first-year";
import type { Profile } from "@/lib/profile";
import { SharedMentoringCardPreview } from "@/components/shared-mentoring-card-preview";

const MENTOR_FIELD_KEYS = {
  mentor_phone: "mentor_phone",
  mentor_contact_email: "mentor_contact_email",
} as const;

const MENTEE_FIELD_KEYS = {
  phone: "phone",
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
};

export function MentorContactSettingsForm({ profile }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  const isMentor = isMentorForAccountRoleBadges(profile.is_mentor);
  const isFirstYear = isWithinFirstYearSinceDateOfHire(profile.date_of_hire);
  const showMenteeContactSection = isFirstYear && !isMentor;

  const mentorPhone = profile.mentor_phone ?? "";
  const mentorContactEmail = profile.mentor_contact_email ?? "";
  const profilePhone = profile.phone ?? "";
  const personalEmail = profile.personal_email ?? "";

  const [mentorPhoneLocal, setMentorPhoneLocal] = useState(() => formatUsPhoneDisplay(mentorPhone));
  const [profilePhoneLocal, setProfilePhoneLocal] = useState(() => formatUsPhoneDisplay(profilePhone));

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

  const { status, errorMessage, scheduleDebouncedSave, saveNow } = useSettingsAutoSave(formRef, saveFn, onSaveSuccess);

  const [feedbackTargetKey, setFeedbackTargetKey] = useState<string | null>(null);

  useEffect(() => {
    setMentorPhoneLocal(formatUsPhoneDisplay(profile.mentor_phone ?? ""));
  }, [profile.mentor_phone]);

  useEffect(() => {
    setProfilePhoneLocal(formatUsPhoneDisplay(profile.phone ?? ""));
  }, [profile.phone]);

  useEffect(() => {
    if (status === "idle") {
      setFeedbackTargetKey(null);
    }
  }, [status]);

  const settingsFieldFeedback: FieldFeedback = {
    activeKey: feedbackTargetKey,
    status,
    errorMessage,
  };

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">Community</h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            Forum, notes, mentoring, and other community-facing preferences.
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-8">
        {showMenteeContactSection ? (
          <section
            className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
            aria-labelledby="mentee-contact-settings-heading"
          >
            <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
              <h3
                id="mentee-contact-settings-heading"
                className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                Your Contact Information
              </h3>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Provide your contact details so your assigned mentor can reach you.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="settings_profile_phone"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Phone
                </label>
                <input
                  id="settings_profile_phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={profilePhoneLocal}
                  placeholder="e.g. (555) 234-5678"
                  className="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
                  onChange={(e) => {
                    const formatted = formatUsPhoneDisplay(e.target.value);
                    setProfilePhoneLocal(formatted);
                    setFeedbackTargetKey(MENTEE_FIELD_KEYS.phone);
                    scheduleDebouncedSave();
                  }}
                  onBlur={() => {
                    const formatted = formatUsPhoneDisplay(profilePhoneLocal);
                    flushSync(() => {
                      setProfilePhoneLocal(formatted);
                    });
                    setFeedbackTargetKey(MENTEE_FIELD_KEYS.phone);
                    saveNow();
                  }}
                />
                <FieldSaveFeedback fieldKey={MENTEE_FIELD_KEYS.phone} feedback={settingsFieldFeedback} />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Your profile phone can be shown to your mentor on your Mentoring card when available.
                </p>
              </div>
              <div>
                <label
                  htmlFor="settings_personal_contact_email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Personal contact email <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="settings_personal_contact_email"
                  name="personal_email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  key={`personal-email-${personalEmail}`}
                  defaultValue={personalEmail}
                  placeholder="name@example.com"
                  className="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
                  onInput={() => {
                    setFeedbackTargetKey(MENTEE_FIELD_KEYS.personal_email);
                    scheduleDebouncedSave();
                  }}
                />
                <FieldSaveFeedback fieldKey={MENTEE_FIELD_KEYS.personal_email} feedback={settingsFieldFeedback} />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Optional non-company email for mentoring outreach (not your login email).
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section
              className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
              aria-labelledby="mentor-contact-settings-heading"
            >
              <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
                <h3
                  id="mentor-contact-settings-heading"
                  className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  Mentor Contact
                </h3>
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Add personal contact details for your mentee(s).
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Shown on your{" "}
                <span className="font-medium text-slate-600 dark:text-slate-400">Mentoring</span> card for contact
                outside CrewRules. Company email is included automatically.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="settings_mentor_phone"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Mentor phone
                  </label>
                  <input
                    id="settings_mentor_phone"
                    name="mentor_phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={mentorPhoneLocal}
                    placeholder="e.g. (555) 234-5678"
                    className="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
                    onChange={(e) => {
                      const formatted = formatUsPhoneDisplay(e.target.value);
                      setMentorPhoneLocal(formatted);
                      setFeedbackTargetKey(MENTOR_FIELD_KEYS.mentor_phone);
                      scheduleDebouncedSave();
                    }}
                    onBlur={() => {
                      const formatted = formatUsPhoneDisplay(mentorPhoneLocal);
                      flushSync(() => {
                        setMentorPhoneLocal(formatted);
                      });
                      setFeedbackTargetKey(MENTOR_FIELD_KEYS.mentor_phone);
                      saveNow();
                    }}
                  />
                  <FieldSaveFeedback fieldKey={MENTOR_FIELD_KEYS.mentor_phone} feedback={settingsFieldFeedback} />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    If blank, your profile phone number is used on the card when available.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="settings_mentor_contact_email"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Mentor contact email
                  </label>
                  <input
                    id="settings_mentor_contact_email"
                    name="mentor_contact_email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    key={`mentor-email-${mentorContactEmail}`}
                    defaultValue={mentorContactEmail}
                    placeholder="name@example.com"
                    className="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
                    onInput={() => {
                      setFeedbackTargetKey(MENTOR_FIELD_KEYS.mentor_contact_email);
                      scheduleDebouncedSave();
                    }}
                  />
                  <FieldSaveFeedback fieldKey={MENTOR_FIELD_KEYS.mentor_contact_email} feedback={settingsFieldFeedback} />
                </div>
              </div>
            </section>
            <SharedMentoringCardPreview profile={profile} />
          </>
        )}

        {showMenteeContactSection ? (
          <div className="hidden" aria-hidden>
            <input type="hidden" name="mentor_phone" value={profile.mentor_phone ?? ""} />
            <input type="hidden" name="mentor_contact_email" value={profile.mentor_contact_email ?? ""} />
          </div>
        ) : null}

        <PilotPersonalFieldsPreserve profile={profile} />
        <SettingsProfilePreserveFields profile={profile} omitMentorFields />
      </form>
    </div>
  );
}
