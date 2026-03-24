import { redirect } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server-action";
import { CompleteProfileForm } from "./complete-profile-form";

const TENANT = "frontier";
const PORTAL = "pilots";
const PORTAL_PATH = `/${TENANT}/${PORTAL}/portal`;
const LOGIN_PATH = `/${TENANT}/${PORTAL}/login`;

export default async function CompleteProfilePage() {
  const supabase = await createActionClient();
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
    .select("base_airport, position, date_of_hire, home_airport")
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

  if (hasRequiredOnboarding) {
    redirect(PORTAL_PATH);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] shadow-lg shadow-black/30 p-8 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <div className="text-center">
            <h1 className="text-3xl font-bold">
              Set Up Your Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs text-white">™</span> Profile
            </h1>
            <p className="mt-4 text-slate-300 max-w-md mx-auto">
              A few details to personalize your portal —
              <br />
              Commute Assist™, Pay Projection™, Report Times, and more.
            </p>
          </div>
          <CompleteProfileForm />
        </div>
      </div>
    </main>
  );
}
