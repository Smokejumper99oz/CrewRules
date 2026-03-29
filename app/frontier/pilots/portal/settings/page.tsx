import type { ReactNode } from "react";
import Link from "next/link";
import {
  getProfile,
  getCommunitySettingsTabLabel,
  shouldShowCommunityMentoringSettings,
} from "@/lib/profile";

const SETTINGS_BASE = "/frontier/pilots/portal/settings";

type HubSection = {
  href: string;
  title: ReactNode;
  description: string;
  comingNext?: boolean;
};

function buildSections(communityCardTitle: string, includeCommunityMentoring: boolean): HubSection[] {
  const sections: HubSection[] = [
    {
      href: `${SETTINGS_BASE}/pilot`,
      title: "Pilot",
      description: "Name, base, equipment, and employment details.",
    },
    {
      href: `${SETTINGS_BASE}/commute-assist`,
      title: (
        <>
          Commute Assist
          <span className="align-super text-[10px]">™</span>
        </>
      ),
      description: "Home airport, commute buffers, and assist options.",
    },
    {
      href: `${SETTINGS_BASE}/schedule-import`,
      title: "Schedule Import",
      description: "FLICA or ELP sync and your CrewRules import email.",
    },
    {
      href: `${SETTINGS_BASE}/family-view`,
      title: "Family View",
      description: "What shared viewers see and Family View toggles.",
    },
    {
      href: `${SETTINGS_BASE}/pay-projection`,
      title: "Pay Projection",
      description: "Estimated pay and projection display options.",
    },
  ];
  if (includeCommunityMentoring) {
    sections.push({
      href: `${SETTINGS_BASE}/community`,
      title: communityCardTitle,
      description: "Mentor contact details for your mentees.",
    });
  }
  sections.push(
    {
      href: `${SETTINGS_BASE}/subscription`,
      title: "Subscription",
      description: "Plans, trial, billing, and Pro access.",
    },
    {
      href: `${SETTINGS_BASE}/account`,
      title: "Account",
      description: "Sign-in email and password.",
    },
    {
      href: `${SETTINGS_BASE}/notifications`,
      title: "Notifications",
      description: "Alerts and notification preferences.",
      comingNext: true,
    },
    {
      href: `${SETTINGS_BASE}/preferences`,
      title: "Preferences",
      description: "Display, timezone, and portal personalization.",
      comingNext: true,
    },
  );
  return sections;
}

export default async function SettingsIndexPage() {
  const profile = await getProfile();
  const includeCommunityMentoring = shouldShowCommunityMentoringSettings(profile);
  const communityCardTitle = getCommunitySettingsTabLabel(profile);
  const sections = buildSections(communityCardTitle, includeCommunityMentoring);

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">Settings</h2>
          <p className="mt-1 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            Settings is the home for your pilot profile, schedule and commute tools, Family View, pay projection,
            community (mentor) preferences, subscription, account security, and everything else you personalize in
            CrewRules.
          </p>
        </div>
      </div>

      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4">
        {sections.map(({ href, title, description, comingNext }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition hover:border-[#75C043]/45 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-500/35 dark:hover:bg-white/[0.06] sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</span>
                {comingNext && (
                  <span className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
                    Coming next
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
                {description}
              </p>
              {comingNext && (
                <p className="mt-2 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-500">
                  Section opens in Settings — controls are on the way.
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
