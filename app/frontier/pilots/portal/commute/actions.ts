"use server";

import { createActionClient } from "@/lib/supabase/server-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/profile";
import { fetchFlightsFromAviationStack } from "@/lib/aviationstack";
import { getRouteTzs } from "@/lib/airports";

/** Cache version for commute_flight_cache. Bump to purge old entries (e.g. 3-flight cache). */
const CACHE_VERSION = "v2";

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

  const origin = (input.origin ?? "").trim().toUpperCase();
  const destination = (input.destination ?? "").trim().toUpperCase();

  if (!origin || origin.length !== 3) {
    return { ok: false as const, reason: "missing_origin" as const, message: "Origin airport is required (3-letter IATA)." };
  }
  if (!destination || destination.length !== 3) {
    return { ok: false as const, reason: "missing_destination" as const, message: "Destination airport is required (3-letter IATA)." };
  }

  const now = new Date();
  const createdAt = profile.created_at ? new Date(profile.created_at) : null;
  const accountAgeDays = createdAt ? daysBetween(now, createdAt) : 9999;

  console.log("Commute Assist getRouteTzs:", { origin, destination });

  // When forceRefresh: skip cache entirely, hit API, overwrite cache, return source: "api"
  if (input.forceRefresh) {
    const { originTz, destTz } = await getRouteTzs(origin, destination);

    // Plan gating for forceRefresh
    const isPaid = subscription === "pro" || subscription === "enterprise";
    if (!isPaid && accountAgeDays >= 30) {
      return {
        ok: false as const,
        reason: "demo_only" as const,
        message: "Commute Assist is demo-only after 30 days on Free. Upgrade to Pro to refresh live data.",
      };
    }
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

    try {
      const { flights, notice } = await fetchFlightsFromAviationStack(origin, destination, input.date, { noCache: true }); // bypass dev cache

      const row = {
        tenant,
        user_id: userId,
        origin,
        destination,
        commute_date: input.date,
        cache_version: CACHE_VERSION,
        data: flights,
        fetched_at: now.toISOString(),
      };
      const { error: upsertErr } = await admin
        .from("commute_flight_cache")
        .upsert(row, {
          onConflict: "tenant,user_id,commute_date,origin,destination,cache_version",
        });
      if (upsertErr) console.error("Commute cache upsert failed", upsertErr);

      if (!isPaid && accountAgeDays < 30) {
        const msISO = monthStartISO(now);
        const { error: rpcErr } = await admin.rpc("increment_commute_refresh_usage", {
          p_tenant: tenant,
          p_user_id: userId,
          p_month_start: msISO,
        });
        if (rpcErr) console.error("increment_commute_refresh_usage failed", rpcErr);
      }

      return { ok: true as const, source: "api" as const, flights, notice, originTz, destTz };
    } catch (err) {
      console.error("Commute Assist failed", err);
      return { ok: false as const, reason: "unavailable" as const, message: "Commute Assist temporarily unavailable." };
    }
  }

  // 1) Cache-first (return if exists) — only v2 entries
  const { data: cached, error: cacheErr } = await admin
    .from("commute_flight_cache")
    .select("data")
    .eq("tenant", tenant)
    .eq("user_id", userId)
    .eq("commute_date", input.date)
    .eq("origin", origin)
    .eq("destination", destination)
    .eq("cache_version", CACHE_VERSION)
    .maybeSingle();

  if (cacheErr) {
    console.error("Commute cache lookup failed", cacheErr);
  }

  if (cached?.data) {
    const { originTz, destTz } = await getRouteTzs(origin, destination);
    return { ok: true as const, source: "cache" as const, flights: cached.data, notice: undefined, originTz, destTz };
  }

  // 2) Plan gating (cache miss)
  const isPaid = subscription === "pro" || subscription === "enterprise";

  if (!isPaid && accountAgeDays >= 30) {
    return {
      ok: false as const,
      reason: "demo_only" as const,
      message: "Commute Assist is demo-only after 30 days on Free. Upgrade to Pro to refresh live data.",
    };
  }

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

  // 3) Hit AviationStack (cache miss)
  try {
    const { originTz, destTz } = await getRouteTzs(origin, destination);
    const { flights, notice } = await fetchFlightsFromAviationStack(origin, destination, input.date);

    // 4) Write cache (upsert on unique key)
    const row = {
      tenant,
      user_id: userId,
      origin,
      destination,
      commute_date: input.date,
      cache_version: CACHE_VERSION,
      data: flights,
      fetched_at: now.toISOString(),
    };
    const { error: upsertErr } = await admin
      .from("commute_flight_cache")
      .upsert(row, {
        onConflict: "tenant,user_id,commute_date,origin,destination,cache_version",
      });
    if (upsertErr) console.error("Commute cache upsert failed", upsertErr);

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

    return { ok: true as const, source: "api" as const, flights, notice, originTz, destTz };
  } catch (err) {
    console.error("Commute Assist failed", err);
    return { ok: false as const, reason: "unavailable" as const, message: "Commute Assist temporarily unavailable." };
  }
}
