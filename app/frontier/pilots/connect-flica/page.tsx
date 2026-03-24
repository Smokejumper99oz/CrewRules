import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInboundEmailForDisplay } from "@/lib/email/get-inbound-email-for-display";
import { getScheduleImportStatus } from "@/app/frontier/pilots/portal/schedule/actions";
import { ConnectFlicaOnboarding } from "./connect-flica-onboarding";

const TENANT = "frontier";
const PORTAL = "pilots";
const PORTAL_PATH = `/${TENANT}/${PORTAL}/portal`;
const COMPLETE_PROFILE_PATH = `/${TENANT}/${PORTAL}/complete-profile`;
const LOGIN_PATH = `/${TENANT}/${PORTAL}/login`;

export default async function ConnectFlicaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${LOGIN_PATH}?error=not_signed_in`);
  }

  const email = (user.email ?? "").toLowerCase().trim();
  if (!email.endsWith("@flyfrontier.com")) {
    redirect(`${LOGIN_PATH}?error=company_email_required`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, base_airport, position, date_of_hire, home_airport")
    .eq("id", user.id)
    .eq("tenant", TENANT)
    .eq("portal", PORTAL)
    .maybeSingle();

  const hasRequiredOnboarding =
    profile &&
    !!String(profile.base_airport ?? "").trim() &&
    !!String(profile.position ?? "").trim() &&
    (profile.date_of_hire != null && profile.date_of_hire !== "") &&
    !!String(profile.home_airport ?? "").trim();

  if (!hasRequiredOnboarding) {
    redirect(COMPLETE_PROFILE_PATH);
  }

  let inboundEmail: string | null = null;
  let scheduleStatus: { count: number; lastImportedAt: string | null } = { count: 0, lastImportedAt: null };

  try {
    inboundEmail = await getInboundEmailForDisplay(profile.id);
  } catch {
    inboundEmail = null;
  }

  try {
    const s = await getScheduleImportStatus();
    scheduleStatus = { count: s.count, lastImportedAt: s.lastImportedAt };
  } catch {
    scheduleStatus = { count: 0, lastImportedAt: null };
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] shadow-lg shadow-black/30 p-6 sm:p-8 transition-all duration-200 border-emerald-400/20">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Connect your schedule
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Set this up once and CrewRules will automatically keep your schedule up to date.
            </p>
          </div>

          <ConnectFlicaOnboarding
            inboundEmail={inboundEmail}
            scheduleStatus={scheduleStatus}
            portalPath={PORTAL_PATH}
          />
        </div>
      </div>
    </main>
  );
}
