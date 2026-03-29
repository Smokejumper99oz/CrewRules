"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfilePreferences } from "@/app/frontier/pilots/portal/profile/actions";
import { PilotProfilePersonalFields } from "@/components/pilot-profile-personal-fields";
import { SettingsProfilePreserveFields } from "@/components/settings-profile-preserve-fields";
import { useSettingsAutoSave } from "@/hooks/use-settings-auto-save";
import type { Profile } from "@/lib/profile";

type Props = {
  profile: Profile;
  proActive: boolean;
};

export function PilotProfileSettingsForm({ profile, proActive }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

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

  const onSettingsFieldTouched = useCallback((key: string) => {
    setFeedbackTargetKey(key);
  }, []);

  const immediateCommit = useCallback(() => {
    queueMicrotask(() => saveNow());
  }, [saveNow]);

  const saving = status === "saving";

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">Pilot</h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            Pilot profile and employment details.
          </p>
        </div>
      </div>
      <form
        ref={formRef}
        onSubmit={(e) => e.preventDefault()}
        className="space-y-6"
      >
        <PilotProfilePersonalFields
          profile={profile}
          proActive={proActive}
          saving={saving}
          capFieldsToDohWidth
          hideHomeAirportFields
          onTextEdit={scheduleDebouncedSave}
          onImmediateCommit={immediateCommit}
          onSettingsFieldTouched={onSettingsFieldTouched}
          settingsFieldFeedback={{
            activeKey: feedbackTargetKey,
            status,
            errorMessage,
          }}
        />
        <div className="hidden" aria-hidden>
          <input type="hidden" name="home_airport" value={profile.home_airport ?? ""} />
          <input type="hidden" name="alternate_home_airport" value={profile.alternate_home_airport ?? ""} />
        </div>
        <SettingsProfilePreserveFields profile={profile} />
      </form>
    </div>
  );
}
