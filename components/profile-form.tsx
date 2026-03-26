"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateProfilePreferences, startProTrial, updatePassword, setColorMode } from "@/app/frontier/pilots/portal/profile/actions";
import { DatePickerInput } from "@/components/date-picker-input";
import { CustomFormSelect } from "@/components/custom-form-select";
import { ProBadge } from "@/components/pro-badge";
import { formatLastImport } from "@/components/schedule-status-chip";
import { Lock, Copy, Check } from "lucide-react";
import {
  FRONTIER_CREW_BASE_VALUES,
  FRONTIER_CREW_BASE_OPTIONS,
  getFrontierCrewBaseLabel,
} from "@/lib/frontier-crew-bases";
import { getTimezoneFromAirport, DEFAULT_TIMEZONE } from "@/lib/airport-timezone";
import { FOUNDING_PILOT_CAP } from "@/lib/founding-pilot-constants";

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
    home_airport?: string | null;
    alternate_home_airport?: string | null;
    commute_arrival_buffer_minutes?: number;
    commute_release_buffer_minutes?: number;
    commute_nonstop_only?: boolean;
    commute_two_leg_enabled?: boolean | null;
    commute_two_leg_stop_1?: string | null;
    commute_two_leg_stop_2?: string | null;
    subscription_tier?: "free" | "pro" | "enterprise";
    pro_trial_expires_at?: string | null;
    stripe_customer_id?: string | null;
    billing_source?: string | null;
    billing_interval?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    show_pay_projection?: boolean;
    family_view_enabled?: boolean;
    family_view_show_exact_times?: boolean;
    family_view_show_overnight_cities?: boolean;
    family_view_show_commute_estimates?: boolean;
    color_mode?: "dark" | "light" | "system";
    is_founding_pilot?: boolean;
    founding_pilot_started_at?: string | null;
    founding_pilot_number?: number | null;
    mentor_phone?: string | null;
    mentor_contact_email?: string | null;
  };
  proActive: boolean;
  proBadgeLabel: string;
  proBadgeVariant: "slate" | "gold" | "emerald" | "amber" | "red";
  foundingPilotCount?: number;
  inboundEmail: string | null;
  scheduleStatus?: { count: number; lastImportedAt: string | null };
  showConnectFlicaOnboarding?: boolean;
};

const FRONTIER_CREW_BASE_CANONICAL = new Set(FRONTIER_CREW_BASE_VALUES);

const PROFILE_POSITION_OPTIONS = [
  { value: "captain", label: "Captain" },
  { value: "first_officer", label: "First Officer" },
  { value: "flight_attendant", label: "Flight Attendant" },
] as const;

/** Matches previous <select> first blank option (value submitted as ""). */
const PROFILE_ROLE_OPTIONS = [
  { value: "", label: "Select role" },
  ...PROFILE_POSITION_OPTIONS,
] as const;

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

const COMMUTE_BUFFER_OPTIONS = [30, 60, 90, 120, 180] as const;

function ConnectFlicaSection({
  inboundEmail,
  scheduleStatus,
}: {
  inboundEmail: string | null;
  scheduleStatus: { count: number; lastImportedAt: string | null };
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!inboundEmail) return;
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [inboundEmail]);

  const hasSchedule = scheduleStatus.count > 0;
  const steps = [
    "Copy your CrewRules import email",
    "Open FLICA or ELP settings",
    "Add this email to your schedule distribution list",
    "Your schedule will sync automatically when updates are sent",
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white flex items-center gap-2">
          Connect FLICA (Auto Sync)
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40">
            BETA
          </span>
        </h2>
        <h3 className="text-lg font-semibold text-white mt-3">Connect your schedule automatically</h3>
        <p className="text-sm text-slate-400 mt-2">
          CrewRules syncs your schedule automatically by receiving updates from FLICA or ELP. Set this up once and your
          schedule will always stay up to date.
        </p>
      </div>

      {/* Status indicator */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-3">
        {hasSchedule ? (
          <p className="text-sm text-emerald-300 flex items-center gap-2">
            <span aria-hidden>✅</span>
            <span>
              Connected
              {scheduleStatus.lastImportedAt && (
                <> (Last updated: {formatLastImport(scheduleStatus.lastImportedAt)})</>
              )}
            </span>
          </p>
        ) : (
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <span aria-hidden>⚠️</span>
            <span>Not connected yet</span>
          </p>
        )}
      </div>

      {inboundEmail ? (
        <div className="space-y-4">
          {/* Email + Copy - prominent, mobile-friendly */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1 rounded-xl border border-[#75C043]/40 bg-slate-950/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                Your CrewRules import email
              </p>
              <p className="text-base font-mono text-white break-all">{inboundEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-[#75C043] px-6 py-4 text-sm font-semibold text-slate-950 hover:opacity-95 active:opacity-90 transition min-h-[48px] touch-manipulation"
            >
              {copied ? (
                <>
                  <Check className="size-5" aria-hidden />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-5" aria-hidden />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Step-by-step instructions */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Setup steps</p>
            <ol className="list-decimal list-inside space-y-3 text-sm text-slate-400">
              {steps.map((step, i) => (
                <li key={i} className="pl-1">
                  <span className="text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Your import email will be created after your profile is saved.</p>
      )}
    </section>
  );
}

export function ProfileForm({
  profile,
  proActive,
  proBadgeLabel,
  proBadgeVariant,
  foundingPilotCount = 0,
  inboundEmail,
  scheduleStatus = { count: 0, lastImportedAt: null },
  showConnectFlicaOnboarding = true,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialMessage, setTrialMessage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [router]);

  const canManageSubscription =
    Boolean(profile?.stripe_customer_id) &&
    ((profile?.subscription_tier ?? "free") === "pro" || profile?.billing_source === "stripe");

  /** Beta / Stripe “coming soon” pricing strip for free users and active trial users only (hide for paid Pro and Enterprise). */
  const showBetaPaymentInfo =
    profile?.subscription_tier !== "enterprise" &&
    (!proActive || profile.subscription_tier !== "pro");

  const [baseAirport, setBaseAirport] = useState(profile.base_airport ?? "");
  const [position, setPosition] = useState(() => profile.position ?? "");
  const storedTimezone = profile.base_timezone ?? DEFAULT_TIMEZONE;
  const derivedFromBase = getTimezoneFromAirport(profile.base_airport ?? "DEN");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualTimezone, setManualTimezone] = useState(storedTimezone);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [directFlightsExpanded, setDirectFlightsExpanded] = useState(true);
  const [twoLegExpanded, setTwoLegExpanded] = useState(true);

  const formRef = useRef<HTMLFormElement | null>(null);
  const pristineSnapshotRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const colorMode = profile.color_mode ?? "dark";
  const [selectedColorMode, setSelectedColorMode] = useState<"dark" | "light">(colorMode === "light" ? "light" : "dark");
  const displayTimezoneMode = profile.display_timezone_mode ?? "base";
  const timeFormat = profile.time_format ?? "24h";
  const showTimezoneLabel = profile.show_timezone_label ?? false;
  const homeAirport = profile.home_airport ?? "";
  const alternateHomeAirport = profile.alternate_home_airport ?? "";
  const commuteArrival = profile.commute_arrival_buffer_minutes ?? 60;
  const commuteTwoLegEnabled = profile.commute_two_leg_enabled ?? false;
  const commuteTwoLegStop1 = profile.commute_two_leg_stop_1 ?? "";
  const commuteTwoLegStop2 = profile.commute_two_leg_stop_2 ?? "";
  const commuteRelease = profile.commute_release_buffer_minutes ?? 30;
  const commuteNonstopOnly = profile.commute_nonstop_only ?? true;

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

  const sortedCrewBaseOptions = useMemo(() => {
    const list = [...FRONTIER_CREW_BASE_OPTIONS];
    if (baseAirport && !FRONTIER_CREW_BASE_CANONICAL.has(baseAirport)) {
      list.push({ value: baseAirport, label: getFrontierCrewBaseLabel(baseAirport) });
    }
    list.sort((a, b) => a.value.localeCompare(b.value));
    return [{ value: "", label: "Select crew base" }, ...list];
  }, [baseAirport]);

  function getFormSnapshot(form: HTMLFormElement | null, effectiveTz: string): string | null {
    if (!form) return null;
    const fd = new FormData(form);
    fd.set("base_timezone", effectiveTz);
    const keys = [...new Set(fd.keys())].sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = fd.get(k);
      parts.push(`${k}=${String(v ?? "").trim()}`);
    }
    return parts.join("&");
  }

  const checkDirty = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const current = getFormSnapshot(form, effectiveTimezone);
    const pristine = pristineSnapshotRef.current;
    if (current === null || pristine === null) return;
    setIsDirty((prev) => {
      const next = current !== pristine;
      return next !== prev ? next : prev;
    });
  }, [effectiveTimezone]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || pristineSnapshotRef.current !== null) return;
    pristineSnapshotRef.current = getFormSnapshot(form, effectiveTimezone);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial snapshot only on mount
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = () => checkDirty();
    form.addEventListener("input", handler);
    form.addEventListener("change", handler);
    return () => {
      form.removeEventListener("input", handler);
      form.removeEventListener("change", handler);
    };
  }, [checkDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;

      try {
        const dest = new URL(href, window.location.href);
        const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
        const destPath = dest.pathname.replace(/\/$/, "") || "/";
        if (currentPath === destPath) return;

        const ok = window.confirm("You have unsaved changes. Leave this page without saving?");
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      } catch {
        return;
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

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
      const nextPristine = getFormSnapshot(form, effectiveTimezone);
      if (nextPristine !== null) {
        pristineSnapshotRef.current = nextPristine;
      }
      setIsDirty(false);
      router.refresh();
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Profile Settings</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage your Profile, Commute Settings, Display Preferences, and CrewRules™ Pro features.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProBadge label={proBadgeLabel} variant={proBadgeVariant} />
          {profile?.is_founding_pilot && (
            <div className="inline-flex flex-col items-center rounded-full border border-amber-400/60 bg-slate-900/70 px-3 py-1.5 text-center shadow-amber-500/10 shadow-sm">
              <span className="text-sm font-semibold tracking-wide text-amber-400">Founding Pilot</span>
              {profile?.founding_pilot_number != null ? (
                <span className="text-xs text-amber-400/90">
                  Pilot #{profile.founding_pilot_number} of {FOUNDING_PILOT_CAP}
                </span>
              ) : (
                <>
                  <span className="text-xs text-amber-400/90">Lifetime Beta Member</span>
                  {profile?.founding_pilot_started_at && (
                    <span className="mt-0.5 text-[10px] text-amber-400/70">
                      Since {new Date(profile.founding_pilot_started_at).getFullYear()}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-8">
      {/* Personal Information */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white">Personal Information</h2>
        <p className="text-xs text-slate-500 mb-4">Pilot profile and employment details.</p>
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
              className="profile-input-base mt-1.5 w-full max-w-sm"
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
              className="profile-input-base mt-1.5 w-full max-w-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Employee Number is used for internal portal identification and to enable pilot matching in the CrewRules™ Mentorship Program.
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
              placeholder="mm/dd/yyyy"
              className="profile-input-base mt-1.5 w-full max-w-[12rem] cursor-pointer"
            />
            <p className="mt-1 text-xs text-slate-500">
              Used for internal calculations such as anniversary badges and CrewRules™ Pro pay calculations. Your information is never shared.
            </p>
          </div>
          <div>
            <label htmlFor="position" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Role
            </label>
            <CustomFormSelect
              id="position"
              name="position"
              options={PROFILE_ROLE_OPTIONS}
              placeholder="Select role"
              disabled={saving}
              value={position}
              onValueChange={setPosition}
              triggerClassName="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
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
              disabled={saving}
              value={baseAirport}
              onValueChange={setBaseAirport}
              triggerClassName="profile-input-base mt-1.5 w-full max-w-[8rem] min-h-[44px]"
              containerClassName="max-w-[8rem]"
            />
            <p className="mt-1 text-xs text-slate-500">3-letter IATA airport code. Used for reserve calculations and default commute planning. If a trip starts from another airport, Commute Assist automatically uses that airport instead.</p>
          </div>
          <div>
            <label htmlFor="home_airport" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Home Airport
            </label>
            <input
              id="home_airport"
              name="home_airport"
              type="text"
              defaultValue={homeAirport}
              maxLength={3}
              placeholder="e.g. MCO"
              disabled={!proActive}
              readOnly={!proActive}
              className={`profile-input-base mt-1.5 w-full max-w-[8rem] placeholder:normal-case uppercase disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              style={{ textTransform: "uppercase" }}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
              }}
            />
            <p className="mt-1 text-xs text-slate-500">3-letter IATA code. This is where your commute normally begins.</p>
            {!proActive && (
              <button type="button" className="text-xs text-[#75C043] hover:underline mt-1 inline-block">Start your free 14-day trial</button>
            )}
          </div>
          <div>
            <label htmlFor="alternate_home_airport" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Alternate Home Airport <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="alternate_home_airport"
              name="alternate_home_airport"
              type="text"
              defaultValue={alternateHomeAirport}
              maxLength={3}
              placeholder="e.g. MCO"
              disabled={!proActive}
              readOnly={!proActive}
              className={`profile-input-base mt-1.5 w-full max-w-[8rem] placeholder:normal-case uppercase disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              style={{ textTransform: "uppercase" }}
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
              }}
            />
            <p className="mt-1 text-xs text-slate-500">
              Backup home airport used when flights from your primary home airport are limited.
            </p>
          </div>
          <div>
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
                <label htmlFor="base_timezone_override" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Override crew base timezone
                </label>
                <select
                  id="base_timezone_override"
                  value={manualTimezone}
                  onChange={(e) => setManualTimezone(e.target.value)}
                  className="profile-select-base profile-select mt-1.5 w-full max-w-sm"
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
            <label htmlFor="equipment" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Equipment <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              id="equipment"
              name="equipment"
              type="text"
              defaultValue={profile.equipment ?? "A320/A321"}
              placeholder="e.g. A320, A321"
              className="mt-1.5 w-full max-w-sm profile-input-base"
            />
          </div>
        </div>
      </section>

      {/* Mentor contact (mentee-facing card) */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white">Mentor Contact</h2>
        <p className="text-xs text-slate-500 mb-4">
          Optional contact details your mentees see on the <span className="font-medium text-slate-600 dark:text-slate-400">Mentoring</span>{" "}
          contact card (Call / Email). This is separate from your login email.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="mentor_phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mentor phone
            </label>
            <input
              id="mentor_phone"
              name="mentor_phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={profile.mentor_phone ?? ""}
              placeholder="e.g. 555-123-4567"
              className="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
            />
            <p className="mt-1 text-xs text-slate-500">
              If blank, your profile phone number is used on the card when available.
            </p>
          </div>
          <div>
            <label htmlFor="mentor_contact_email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mentor contact email
            </label>
            <input
              id="mentor_contact_email"
              name="mentor_contact_email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={profile.mentor_contact_email ?? ""}
              placeholder="name@example.com"
              className="profile-input-base mt-1.5 w-full max-w-sm min-h-[44px]"
            />
          </div>
        </div>
      </section>

      {/* Connect FLICA (Auto Sync) */}
      {showConnectFlicaOnboarding && (
        <ConnectFlicaSection inboundEmail={inboundEmail} scheduleStatus={scheduleStatus} />
      )}

      {/* CrewRules™ Pro Features */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white">
          Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> <span className="text-amber-400">PRO</span> Features
          {!proActive && <span className="ml-1.5 text-xs font-normal text-slate-500">🔒</span>}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          {proActive ? "Advanced tools available with CrewRules™ PRO." : "Upgrade to unlock advanced tools."}
        </p>

        {!proActive && (
          <>
            <button
              type="button"
              onClick={async () => {
                setTrialMessage(null);
                setTrialStarting(true);
                const result = await startProTrial();
                setTrialStarting(false);
                if (result.ok) {
                  router.refresh();
                } else if (result.reason === "trial_active") {
                  setTrialMessage("Trial already active");
                } else if (result.reason === "already_paid") {
                  setTrialMessage("You already have PRO access");
                }
              }}
              disabled={trialStarting}
              className="rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500 transition disabled:opacity-50"
            >
              {trialStarting ? "Starting…" : "Start 14-Day PRO Trial"}
            </button>
          </>
        )}
        {showBetaPaymentInfo && (
          <>
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/95">
              CrewRules™ Pro is currently in Beta. Payments are being finalized with Stripe and will be enabled soon. You can start your free 14-day trial today.
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Early users will be the first to access paid plans once Stripe is live.
            </p>
            {foundingPilotCount > 0 && (
              <div className="mt-3 flex flex-col gap-0.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <span className="text-xs font-medium text-amber-400/90">Founding Pilot Program</span>
                <span className="text-xs text-amber-400/80">
                  {foundingPilotCount} / {FOUNDING_PILOT_CAP} spots claimed
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                className="flex min-h-[88px] min-w-[120px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-center opacity-50 cursor-not-allowed transition"
              >
                <span className="text-sm font-semibold leading-tight text-amber-200">Pro Monthly</span>
                <span className="text-base font-bold leading-tight text-amber-400">$10 / month</span>
                <span className="flex items-center justify-center gap-1 text-xs leading-tight text-slate-400">
                  <Lock className="size-3 opacity-70" aria-hidden />
                  Available Soon
                </span>
              </button>
              <button
                type="button"
                disabled
                className="flex min-h-[88px] min-w-[120px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-center opacity-50 cursor-not-allowed transition"
              >
                <span className="text-sm font-semibold leading-tight text-amber-200">Pro Annual</span>
                <span className="text-base font-bold leading-tight text-amber-400">$99 / year</span>
                <span className="flex items-center justify-center gap-1 text-xs leading-tight text-slate-400">
                  <Lock className="size-3 opacity-70" aria-hidden />
                  Best Value • Available Soon
                </span>
              </button>
              <button
                type="button"
                disabled
                className="flex min-h-[88px] min-w-[120px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-center shadow-amber-500/5 opacity-50 cursor-not-allowed transition hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]"
              >
                <span className="text-sm font-semibold leading-tight text-amber-200">Founding Pilot</span>
                <span className="text-base font-bold leading-tight text-amber-400">$59 / year</span>
                <span className="flex items-center justify-center gap-1 text-xs leading-tight text-slate-400">
                  <Lock className="size-3 opacity-70" aria-hidden />
                  Limited Beta Offer • Unlocking Soon
                </span>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Early beta users will get first access when billing goes live.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>Upgrade to CrewRules™ Pro to support continued development and unlock Pro features. Early members help us build better tools for pilots and flight attendants.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>CrewRules™ merchandise is on the way — including our new cap and lanyard.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>Pro supporters will receive early access when they arrive.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>Beta testers help shape CrewRules™ by testing new features early and helping us improve the tools pilots rely on.</span>
              </li>
            </ul>
          </>
        )}
        {!proActive && (
          <>
            {trialMessage && (
              <p className="mt-2 text-sm text-amber-200/90">{trialMessage}</p>
            )}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-4 opacity-60">
              <p className="mb-2 text-sm font-medium text-slate-300">CrewRules™ Pro includes</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                  <span>Commute Assist™ — Smart commute planning based on your schedule.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                  <span>Pay Projections — Forecast trip and monthly credit, block, and pay</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                  <span>Advanced Weather Brief™ — Operational weather analysis for your next scheduled flight.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                  <span>CrewRules™ Family View™ — Share schedule insights with your family and friends.</span>
                </li>
              </ul>
            </div>
          </>
        )}

        {/* CrewRules™ Commute Assist™ */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Commute Assist<span className="align-super text-[10px]">™</span>
            </h3>
            {!proActive && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">Pro</span>}
          </div>
          {proActive && <p className="text-xs text-slate-500 mb-4">Tools to help plan safer and more reliable commutes.</p>}
          {!proActive && (
            <p className="text-xs text-amber-400 mt-2 mb-4">
              🔒 Available with CrewRules™ Pro — start your free 14-day trial to unlock this feature.
            </p>
          )}

          {/* Direct Flights card */}
          <div className={`rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 ${!proActive ? "opacity-80" : ""}`}>
            <button
              type="button"
              onClick={() => setDirectFlightsExpanded(!directFlightsExpanded)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors rounded-t-xl"
            >
              <span>Direct Flights</span>
              <span className="text-slate-500 shrink-0" aria-hidden>{directFlightsExpanded ? "−" : "+"}</span>
            </button>
            <div className={directFlightsExpanded ? "space-y-4 px-4 pb-4" : "hidden"}>
              <div>
                <label
                  htmlFor="commute_arrival_buffer_minutes"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Arrival Buffer Before Duty
                </label>
                <select
                  id="commute_arrival_buffer_minutes"
                  name="commute_arrival_buffer_minutes"
                  defaultValue={commuteArrival}
                  disabled={!proActive}
                  className={`profile-select-base profile-select mt-1.5 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {COMMUTE_BUFFER_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Minimum time you want to arrive before your report time. Used for commute safety calculations.
                </p>
              </div>
              <input type="hidden" name="commute_release_buffer_minutes" value="0" />
              <input type="hidden" name="commute_nonstop_only" value="1" />
            </div>
          </div>

          {/* 2 Leg Options card */}
          <div className={`mt-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 ${!proActive ? "opacity-80" : ""}`}>
            <button
              type="button"
              onClick={() => setTwoLegExpanded(!twoLegExpanded)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors rounded-t-xl"
            >
              <span className="flex items-center gap-2">
                <span>2 Leg Options</span>
                <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 text-xs font-semibold px-2 py-0.5 rounded-full">IN DEVELOPMENT</span>
              </span>
              <span className="text-slate-500 shrink-0" aria-hidden>{twoLegExpanded ? "−" : "+"}</span>
            </button>
            <div className={twoLegExpanded ? "space-y-4 px-4 pb-4" : "hidden"}>
              <div className="flex items-center gap-3">
                <input
                  id="commute_two_leg_enabled"
                  name="commute_two_leg_enabled"
                  type="checkbox"
                  value="1"
                  defaultChecked={commuteTwoLegEnabled}
                  disabled={!proActive}
                  className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
                />
                {proActive && <input type="hidden" name="commute_two_leg_enabled" value="0" />}
                <label htmlFor="commute_two_leg_enabled" className="text-sm font-medium text-slate-300">
                  Enable 2-Leg Search
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Used when no direct flight exists. Example: SAV → ATL → SJU or SAV → MCO → SJU.
              </p>
              <div>
                <label htmlFor="commute_two_leg_stop_1" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Connection Airport 1
                </label>
                <input
                  id="commute_two_leg_stop_1"
                  name="commute_two_leg_stop_1"
                  type="text"
                  defaultValue={commuteTwoLegStop1}
                  maxLength={3}
                  placeholder="e.g. ATL"
                  disabled={!proActive}
                  readOnly={!proActive}
                  className={`profile-input-base mt-1.5 w-full max-w-[8rem] placeholder:normal-case uppercase disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  style={{ textTransform: "uppercase" }}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.toUpperCase();
                  }}
                />
              </div>
              <div>
                <label htmlFor="commute_two_leg_stop_2" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Connection Airport 2
                </label>
                <input
                  id="commute_two_leg_stop_2"
                  name="commute_two_leg_stop_2"
                  type="text"
                  defaultValue={commuteTwoLegStop2}
                  maxLength={3}
                  placeholder="e.g. MCO"
                  disabled={!proActive}
                  readOnly={!proActive}
                  className={`profile-input-base mt-1.5 w-full max-w-[8rem] placeholder:normal-case uppercase disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  style={{ textTransform: "uppercase" }}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.toUpperCase();
                  }}
                />
              </div>
            </div>
          </div>

          {!proActive && (
            <div className="hidden" aria-hidden>
              <input type="hidden" name="home_airport" value={homeAirport} />
              <input type="hidden" name="alternate_home_airport" value={alternateHomeAirport} />
              <input type="hidden" name="commute_arrival_buffer_minutes" value={commuteArrival} />
              <input type="hidden" name="commute_two_leg_enabled" value={commuteTwoLegEnabled ? "1" : "0"} />
              <input type="hidden" name="commute_two_leg_stop_1" value={commuteTwoLegStop1} />
              <input type="hidden" name="commute_two_leg_stop_2" value={commuteTwoLegStop2} />
            </div>
          )}
        </div>

        {/* CrewRules™ Pay Projections™ */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Pay Projections<span className="align-super text-[10px]">™</span>
            </h3>
            {!proActive && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">Pro</span>}
          </div>
          {proActive && <p className="text-xs text-slate-500 mb-4">Estimate trip and monthly credit, block, and pay.</p>}
          {!proActive && (
            <p className="text-xs text-amber-400 mt-2 mb-4">
              🔒 Available with CrewRules™ Pro — start your free 14-day trial to unlock this feature.
            </p>
          )}
          <div className={`space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-4 ${!proActive ? "opacity-80" : ""}`}>
            <div className="flex items-center gap-3">
              {proActive ? (
                <input type="hidden" name="show_pay_projection" value="0" />
              ) : (
                <input type="hidden" name="show_pay_projection" value={profile?.show_pay_projection ? "1" : "0"} />
              )}
              <input
                id="show_pay_projection"
                name={proActive ? "show_pay_projection" : undefined}
                type="checkbox"
                defaultChecked={Boolean(profile?.show_pay_projection ?? false)}
                value="1"
                disabled={!proActive}
                className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <label htmlFor="show_pay_projection" className="text-sm text-slate-300">
                Enable Pay Projections
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Display estimated monthly pay and credit calculations. Available with CrewRules™ PRO.
            </p>
          </div>
        </div>

        {/* CrewRules™ Family View™ */}
        <div id="family-view-sharing" className="mt-8">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Family View<span className="align-super text-[10px]">™</span>
            </h3>
            {!proActive && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">Pro</span>}
          </div>
          {proActive && <p className="text-xs text-slate-500 mb-4">Share schedule visibility with family or trusted viewers.</p>}
          {!proActive && (
            <p className="text-xs text-amber-400 mt-2 mb-4">
              🔒 Available with CrewRules™ Pro — start your free 14-day trial to unlock this feature.
            </p>
          )}
          <div className={`space-y-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-4 ${!proActive ? "opacity-80" : ""}`}>
            <div className="flex items-center gap-3">
              {proActive ? (
                <input type="hidden" name="family_view_enabled" value="0" />
              ) : (
                <input type="hidden" name="family_view_enabled" value={profile?.family_view_enabled ? "1" : "0"} />
              )}
              <input
                id="family_view_enabled"
                name={proActive ? "family_view_enabled" : undefined}
                type="checkbox"
                defaultChecked={Boolean(profile?.family_view_enabled ?? false)}
                value="1"
                disabled={!proActive}
                className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <label htmlFor="family_view_enabled" className="text-sm text-slate-300">
                Enable Family View
              </label>
            </div>
            <div className="flex items-center gap-3">
              {proActive ? (
                <input type="hidden" name="family_view_show_exact_times" value="0" />
              ) : (
                <input type="hidden" name="family_view_show_exact_times" value={profile?.family_view_show_exact_times ? "1" : "0"} />
              )}
              <input
                id="family_view_show_exact_times"
                name={proActive ? "family_view_show_exact_times" : undefined}
                type="checkbox"
                defaultChecked={Boolean(profile?.family_view_show_exact_times ?? true)}
                value="1"
                disabled={!proActive}
                className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <label htmlFor="family_view_show_exact_times" className="text-sm text-slate-300">
                Show Exact Times
              </label>
            </div>
            <div className="flex items-center gap-3">
              {proActive ? (
                <input type="hidden" name="family_view_show_overnight_cities" value="0" />
              ) : (
                <input type="hidden" name="family_view_show_overnight_cities" value={profile?.family_view_show_overnight_cities ? "1" : "0"} />
              )}
              <input
                id="family_view_show_overnight_cities"
                name={proActive ? "family_view_show_overnight_cities" : undefined}
                type="checkbox"
                defaultChecked={Boolean(profile?.family_view_show_overnight_cities ?? true)}
                value="1"
                disabled={!proActive}
                className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <label htmlFor="family_view_show_overnight_cities" className="text-sm text-slate-300">
                Show Overnight Cities
              </label>
            </div>
            <div className="flex items-center gap-3">
              {proActive ? (
                <input type="hidden" name="family_view_show_commute_estimates" value="0" />
              ) : (
                <input type="hidden" name="family_view_show_commute_estimates" value={profile?.family_view_show_commute_estimates ? "1" : "0"} />
              )}
              <input
                id="family_view_show_commute_estimates"
                name={proActive ? "family_view_show_commute_estimates" : undefined}
                type="checkbox"
                defaultChecked={Boolean(profile?.family_view_show_commute_estimates ?? true)}
                value="1"
                disabled={!proActive}
                className={`h-4 w-4 rounded border-white/20 bg-slate-900/60 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-70 disabled:cursor-not-allowed ${!proActive ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <label htmlFor="family_view_show_commute_estimates" className="text-sm text-slate-300">
                Show Commute Estimates
              </label>
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-sm text-slate-400">Included viewers: 0 / 2</p>
            </div>
            <div>
              <button
                type="button"
                disabled
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed"
              >
                Invite Family Member
              </button>
              <p className="mt-1 text-xs text-slate-500">Coming next</p>
            </div>
          </div>
        </div>

        {/* Advanced AI */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200">Advanced AI</h3>
            {!proActive && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">Pro</span>}
          </div>
          {proActive && <p className="text-xs text-slate-500 mb-4">AI-powered search and insights across your documents and schedule.</p>}
          {!proActive && (
            <p className="text-xs text-amber-400 mt-2 mb-4">
              🔒 Available with CrewRules™ Pro — start your free 14-day trial to unlock this feature.
            </p>
          )}
          <div className={`rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-4 ${!proActive ? "opacity-80" : ""}`}>
            <p className="text-sm text-slate-400">
              {proActive ? "AI features are available in the Ask and Library sections." : "Unlock Pro to access AI search and document insights."}
            </p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white">Appearance</h2>
        <p className="text-xs text-slate-500 mb-4">Theme preference for the pilot portal.</p>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Theme</span>
            <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 text-xs font-semibold px-2 py-0.5 rounded-full">IN DEVELOPMENT</span>
          </div>
          <input type="hidden" name="color_mode" value={selectedColorMode} />
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
            {(["dark", "light"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setSelectedColorMode(mode);
                  document.documentElement.setAttribute("data-theme", mode);
                  setColorMode(mode).catch(console.error);
                }}
                className={`touch-target touch-pad rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  selectedColorMode === mode
                    ? "bg-[#75C043] text-slate-950"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
                }`}
              >
                {mode === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule Display */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white">Schedule Display</h2>
        <p className="text-xs text-slate-500 mb-4">Controls how your schedule is shown.</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="display_timezone_mode" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Schedule Time Reference
            </label>
            <select
              id="display_timezone_mode"
              name="display_timezone_mode"
              defaultValue={displayTimezoneMode === "toggle" ? "both" : displayTimezoneMode}
              className="profile-select-base profile-select mt-1.5"
            >
              <option value="base">Base Time (Recommended)</option>
              <option value="device">Device local time</option>
              <option value="both">Show both (Base + Device)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Choose which timezone is used when displaying schedule times.
            </p>
          </div>
          <div>
            <label htmlFor="time_format" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Time Format
            </label>
            <select
              id="time_format"
              name="time_format"
              defaultValue={timeFormat}
              className="profile-select-base profile-select mt-1.5"
            >
              <option value="24h">24-hour (Default)</option>
              <option value="12h">12-hour (AM/PM)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Choose how times are displayed in the schedule.
            </p>
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

      {/* Account */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-1 dark:text-white">Account</h2>
        <p className="text-xs text-slate-500 mb-4">Manage your CrewRules™ Pro subscription and account settings.</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-3 space-y-3">
          {canManageSubscription && (
            <div>
              <span className="text-xs font-medium text-slate-500">Subscription</span>
              {(profile?.billing_interval || profile?.current_period_end || profile?.cancel_at_period_end) && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {profile?.billing_interval && (
                    <span className="capitalize">{profile.billing_interval}</span>
                  )}
                  {profile?.current_period_end && (
                    <span>
                      {profile?.billing_interval && " · "}
                      {profile?.cancel_at_period_end
                        ? `Access until ${new Date(profile.current_period_end).toLocaleDateString()}`
                        : `Renews ${new Date(profile.current_period_end).toLocaleDateString()}`}
                    </span>
                  )}
                  {profile?.cancel_at_period_end && (
                    <span className="text-amber-400/90"> · Cancels at period end</span>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={async () => {
                  setPortalLoading(true);
                  try {
                    const res = await fetch("/api/stripe/portal", { method: "POST" });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                    else setPortalLoading(false);
                  } catch {
                    setPortalLoading(false);
                  }
                }}
                disabled={portalLoading}
                className="mt-2 text-sm text-[#75C043] hover:text-[#75C043]/80 font-medium disabled:opacity-50"
              >
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
            </div>
          )}
          <div className={canManageSubscription ? "pt-3 border-t border-white/5" : undefined}>
            <span className="text-xs font-medium text-slate-500">Email</span>
            <p className="text-sm text-white">{profile.email ?? "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Email is managed by CrewRules™ based on your airline access and cannot be edited.</p>
          </div>
          <div className="pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                setShowChangePassword(!showChangePassword);
                setPasswordMessage(null);
              }}
              className="text-sm text-[#75C043] hover:text-[#75C043]/80 font-medium"
            >
              {showChangePassword ? "Cancel" : "Change Password"}
            </button>
            {showChangePassword && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const newPw = (form.elements.namedItem("new_password") as HTMLInputElement)?.value ?? "";
                  const confirm = (form.elements.namedItem("confirm_password") as HTMLInputElement)?.value ?? "";
                  if (newPw !== confirm) {
                    setPasswordMessage({ type: "error", text: "Passwords do not match" });
                    return;
                  }
                  setPasswordSaving(true);
                  setPasswordMessage(null);
                  const result = await updatePassword(newPw);
                  setPasswordSaving(false);
                  if ("error" in result) {
                    setPasswordMessage({ type: "error", text: result.error });
                  } else {
                    setPasswordMessage({ type: "success", text: "Password updated." });
                    setShowChangePassword(false);
                    form.reset();
                  }
                }}
                className="mt-3 space-y-3"
              >
                <div>
                  <label htmlFor="new_password" className="block text-xs font-medium text-slate-400">
                    New password
                  </label>
                  <input
                    id="new_password"
                    name="new_password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="mt-1 w-full max-w-xs profile-input-base"
                  />
                </div>
                <div>
                  <label htmlFor="confirm_password" className="block text-xs font-medium text-slate-400">
                    Confirm new password
                  </label>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    className="mt-1 w-full max-w-xs profile-input-base"
                  />
                </div>
                {passwordMessage && (
                  <p className={`text-sm ${passwordMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                    {passwordMessage.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-lg bg-[#75C043] px-3 py-2 text-sm font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50"
                >
                  {passwordSaving ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
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
        {saving ? "Saving…" : "Save Profile Changes"}
      </button>
    </form>
    </>
  );
}

/* DEV: Manual test — Commute Settings: (1) Section locked when not Pro; (2) Click "Start 14-Day Pro Trial" → refresh → section unlocks; (3) Edit fields, Save → persists. */
