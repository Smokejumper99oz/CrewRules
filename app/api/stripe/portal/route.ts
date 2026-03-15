import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/lib/stripe/portal";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, subscription_tier, billing_source")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });
    }

    const tier = profile.subscription_tier ?? "free";
    const source = profile.billing_source ?? null;
    const isEligible = tier === "pro" || source === "stripe";

    if (!isEligible) {
      return NextResponse.json({ error: "Not eligible for portal" }, { status: 400 });
    }

    const { url } = await createPortalSession(profile.stripe_customer_id);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal failed";
    console.error("[stripe/portal]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
