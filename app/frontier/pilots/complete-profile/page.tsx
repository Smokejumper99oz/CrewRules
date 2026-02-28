import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TENANT = "frontier";
const PORTAL = "pilots";
const PORTAL_PATH = `/${TENANT}/${PORTAL}/portal`;
const LOGIN_PATH = `/${TENANT}/${PORTAL}/login`;

export default async function CompleteProfilePage() {
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

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      tenant: TENANT,
      portal: PORTAL,
      role: "pilot",
      plan: "free",
      display_timezone_mode: "base",
      time_format: "24h",
    },
    { onConflict: "id" }
  );

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-xl w-full text-center">
          <h1 className="text-3xl font-bold">Complete your profile</h1>
          <p className="mt-4 text-rose-300">
            We couldn&apos;t create your profile yet. Please request access or contact an admin.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href={`/${TENANT}/${PORTAL}/request-access`}
              className="inline-block rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
            >
              Request Access
            </Link>
            <Link
              href={LOGIN_PATH}
              className="inline-block rounded-xl border border-white/20 px-6 py-3 font-medium text-slate-200 hover:bg-white/5 transition"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  redirect(PORTAL_PATH);
}
