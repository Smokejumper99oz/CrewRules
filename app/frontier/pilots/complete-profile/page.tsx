import Link from "next/link";
import { redirect } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server-action";
import { signOut } from "../portal/actions";
import { CompleteProfileForm } from "./complete-profile-form";
import { SignOutButton } from "@/components/sign-out-button";

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

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .eq("tenant", TENANT)
    .eq("portal", PORTAL)
    .maybeSingle();

  if (existing) {
    redirect(PORTAL_PATH);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl font-bold">Complete Your Crew Profile</h1>
        <p className="mt-4 text-slate-300 max-w-md mx-auto">
          This setup powers Commute Assist, pay projection, report times, and other personalized CrewRules features.
        </p>
        <CompleteProfileForm />
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/request-access"
            className="inline-block rounded-xl border border-white/20 px-6 py-3 font-medium text-slate-200 hover:bg-white/5 transition"
          >
            Request Access
          </Link>
          <SignOutButton
            signOut={signOut}
            buttonClassName="inline-block rounded-xl border border-rose-400/50 bg-rose-900/30 px-6 py-3 font-medium text-rose-200 hover:bg-rose-900/50 transition"
          >
            Sign out and use a different account
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
