"use server";

import { createActionClient } from "@/lib/supabase/server-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/profile";
import { fetchFlightsFromAviationStack } from "@/lib/aviationstack";

function monthStartISO(d: Date) {
  const ms = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return ms.toISOString().slice(0, 10);
}

function daysBetween(now: Date, then: Date) {
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getCommuteFlights(input: {
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  forceRefresh?: boolean;
}) {
  const supabase = await createActionClient();
  const admin = createAdminClient();
  const profile = await getProfile();

  if (!profile?.id) {
    return { ok: false as const, reason: "unavailable" as const, message: "Profile not found." };
  }

  const tenant = profile.tenant ?? "frontier";
  const userId = profile.id; // profiles.id is the auth uid in your schema
  const subscription = (profile.subscription_tier ?? "free") as "free" | "pro" | "enterprise";

  const now = new Date();
  const createdAt = profile.created_at ? new Date(profile.created_at) : null;
  const accountAgeDays = createdAt ? daysBetween(now, createdAt) : 9999;

  const origin = input.origin.toUpperCase();
  const destination = input.destination.toUpperCase();

  // 1) Cache-first (return if exists)
  const { data: cached, error: cacheErr } = await admin
    .from("commute_flight_cache")
    .select("data")
    .eq("tenant", tenant)
    .eq("user_id", userId)
    .eq("commute_date", input.date)
    .eq("origin", origin)
    .eq("destination", destination)
    .maybeSingle();

  if (cacheErr) {
    console.error("Commute cache lookup failed", cacheErr);
  }

  // 1) Cache-first (once per commute date unless forceRefresh)
  if (cached?.data && !input.forceRefresh) {
    return { ok: true as const, source: "cache" as const, flights: cached.data };
  }

  // 2) Plan gating only on cache miss or forceRefresh
  const needsRefresh = input.forceRefresh || !cached?.data;
  const isPaid = subscription === "pro" || subscription === "enterprise";

  if (needsRefresh) {
    // Free after 30 days => demo-only (no API refresh)
    if (!isPaid && accountAgeDays >= 30) {
      return {
        ok: false as const,
        reason: "demo_only" as const,
        message: "Commute Assist is demo-only after 30 days on Free. Upgrade to Pro to refresh live data.",
      };
    }

    // Free first 30 days => 3 refreshes per month (only on cache miss/expired)
    if (!isPaid && accountAgeDays < 30) {
      const msISO = monthStartISO(now);

      const { data: usage, error: usageErr } = await supabase
        .from("commute_refresh_usage_monthly")
        .select("refresh_count")
        .eq("tenant", tenant)
        .eq("user_id", userId)
        .eq("month_start", msISO)
        .maybeSingle();

      if (usageErr) {
        console.error("Commute usage lookup failed", usageErr);
        return { ok: false as const, reason: "unavailable" as const, message: "Commute Assist temporarily unavailable." };
      }

      const count = usage?.refresh_count ?? 0;
      if (count >= 3) {
        return {
          ok: false as const,
          reason: "free_limit_reached" as const,
          message: "Free plan limit reached (3 refreshes/month during the first 30 days). Upgrade to Pro for unlimited refresh.",
        };
      }
    }
  }

  // 3) Allowed => hit AviationStack
  try {
    const flights = await fetchFlightsFromAviationStack(origin, destination, input.date);

    // 4) Write cache (latest snapshot per commute date/route)
    const { error: upsertErr } = await admin.from("commute_flight_cache").upsert(
      {
        tenant,
        user_id: userId,
        origin,
        destination,
        commute_date: input.date,
        data: flights,
        fetched_at: now.toISOString(),
      },
      { onConflict: "tenant,user_id,commute_date,origin,destination" }
    );

    if (upsertErr) {
      console.error("Commute cache upsert failed", upsertErr);
    }

    // 5) Increment usage ONLY when an API refresh occurs and only for Free (first 30 days)
    if (!isPaid && accountAgeDays < 30) {
      const msISO = monthStartISO(now);
      const { error: rpcErr } = await admin.rpc("increment_commute_refresh_usage", {
        p_tenant: tenant,
        p_user_id: userId,
        p_month_start: msISO,
      });
      if (rpcErr) console.error("increment_commute_refresh_usage failed", rpcErr);
    }

    return { ok: true as const, source: "api" as const, flights };
  } catch (err) {
    console.error("Commute Assist failed", err);
    return { ok: false as const, reason: "unavailable" as const, message: "Commute Assist temporarily unavailable." };
  }
}
