import Link from "next/link";
import { SharedMentoringCardPreview } from "@/components/shared-mentoring-card-preview";
import { getProfile } from "@/lib/profile";

/** Matches Guide page text links (subtle emerald, underline on hover). */
const settingsLinkClass =
  "text-sm font-medium text-[#75C043] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const shellClass =
  "rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

export default async function PilotPortalMentoringProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <div className={shellClass}>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Mentor Profile</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Sign in to view your mentor profile preview.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Mentor Profile</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          This is the mentor profile card your mentees see inside CrewRules™.
        </p>
      </div>
      <div className="mt-6">
        <SharedMentoringCardPreview profile={profile} variant="portal-mentee" />
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm leading-relaxed text-slate-400">
          Update your mentor contact details and profile information in Settings.
        </p>
        <Link href="/frontier/pilots/portal/settings/community" className={settingsLinkClass}>
          Edit in Settings
        </Link>
      </div>
    </div>
  );
}
