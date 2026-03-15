import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe/checkout";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await req.json();
    const interval = body?.interval as string | undefined;

    if (interval !== "monthly" && interval !== "annual" && interval !== "founding_pilot_monthly") {
      return NextResponse.json(
        { error: "Invalid interval. Use monthly, annual, or founding_pilot_monthly." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (interval === "founding_pilot_monthly") {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_founding_pilot", true);
      if ((count ?? 0) >= 100) {
        return NextResponse.json(
          { error: "Founding Pilot program is full." },
          { status: 400 }
        );
      }
    }

    const { url } = await createCheckoutSession(profile, interval);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
