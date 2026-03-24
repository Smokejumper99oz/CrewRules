"use server";

import { createActionClient } from "@/lib/supabase/server-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/profile";
import { fetchFlightsFromAviationStack } from "@/lib/aviationstack";
import { fetchFlightsFromAerodataBox } from "@/lib/aerodatabox";
import { getRouteTzs } from "@/lib/airports";
import { normalizeFlightTiming } from "@/lib/commute/normalize-flight-timing";
import { deriveOperationalStatus } from "@/lib/commute/derive-operational-status";
import type { CommuteFlight } from "@/lib/aviationstack";

/** Cache version for commute_flight_cache. Bump to purge old entries (e.g. 3-flight cache). */
const CACHE_VERSION = "v3";

/** Derived operationalStatus logic version. Bump when deriveOperationalStatus rules change. Cache read always re-derives; this documents the current rule set. */
const DERIVED_STATUS_VERSION = 1;

/** When Refresh is pressed, reuse DB cache if fetched within this window. Reduces API usage. */
const REFRESH_CACHE_FRESHNESS_MS = 10 * 60 * 1000; // 10 minutes

type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown };

async function safe<T>(fn: () => Promise<T>): Promise<ProviderResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/** Timeout in ms for each provider fetch. Prevents "Failed to fetch" when APIs hang. */
const PROVIDER_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Provider timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Cross-provider normalization: AS uses carrier="" + "B62751", ADB uses "B6" + "B6 2751".
 * Extract carrier (2-char IATA) and numeric flight number so both produce the same key.
 * Some airline codes are alphanumeric (e.g. B6, F9), so carrier regex allows digits.
 */
function normalizedCarrierAndNumber(f: CommuteFlight): { carrier: string; numeric: string } {
  const fn = (f.flightNumber ?? "").replace(/[\s\-_]/g, "").trim();
  const m = fn.match(/^([A-Z0-9]{2})(\d+)$/i);
  const carrier = (f.carrier ?? "").trim().toUpperCase() || (m?.[1] ?? "").toUpperCase();
  const numeric = (m?.[2] ?? fn.replace(/\D/g, "")) || "";
  return { carrier, numeric };
}

/** Dedupe key: carrier + numeric + dep date only. Time omitted so UTC (AS) and local (ADB) match. */
function flightKey(f: CommuteFlight): string {
  const { carrier, numeric } = normalizedCarrierAndNumber(f);
  const dep = f.departureTime ?? "";
  const datePart = dep.slice(0, 10);
  return `${carrier}-${numeric}-${datePart}`;
}

/**
 * Merge and deduplicate flights from multiple providers.
 * Prefer AeroDataBox for same-day display timing: AviationStack scheduled timestamps may arrive
 * in misleading UTC form (e.g. 06:00Z showing as 02:00 local); AeroDataBox uses proper local format.
 * Keep AviationStack live/status fields (estimated, actual, gates, delay) when they add value.
 */
function dedupeFlights(
  aviationstackFlights: CommuteFlight[],
  aerodataboxFlights: CommuteFlight[],
  notice?: string,
  origin?: string,
  destination?: string
): { flights: CommuteFlight[]; mergedCount: number; dedupedCount: number; notice?: string } {
  const mergedCount = aviationstackFlights.length + aerodataboxFlights.length;
  const byKey = new Map<string, CommuteFlight>();
  const isTpaSju = origin === "TPA" && destination === "SJU";
  const isAa1352SavClt = (k: string) =>
    k.startsWith("AA-1352-") && origin?.toUpperCase() === "SAV" && destination?.toUpperCase() === "CLT";

  for (const adb of aerodataboxFlights) {
    const k = flightKey(adb);
    if (isTpaSju) {
      console.log("[Commute Assist] dedupeFlights TPA→SJU row (ADB)", JSON.stringify({
        key: k,
        provider: "AeroDataBox",
        carrier: adb.carrier,
        flightNumber: adb.flightNumber,
        departureTime: adb.departureTime,
        arrivalTime: adb.arrivalTime,
      }));
    }
    if (isAa1352SavClt(k)) {
      console.log("[Commute Assist] AA1352 SAV→CLT dedupe ADB entry", {
        flightKey: k,
        source: "ADB-only (AS may merge later)",
        departureTime: adb.departureTime,
        arrivalTime: adb.arrivalTime,
        dep_scheduled_raw: adb.dep_scheduled_raw,
        dep_estimated_raw: adb.dep_estimated_raw,
        dep_delay_min: adb.dep_delay_min,
      });
    }
    byKey.set(k, adb);
  }
  for (const as of aviationstackFlights) {
    const k = flightKey(as);
    if (isTpaSju) {
      console.log("[Commute Assist] dedupeFlights TPA→SJU row (AS)", JSON.stringify({
        key: k,
        provider: "AviationStack",
        carrier: as.carrier,
        flightNumber: as.flightNumber,
        departureTime: as.departureTime,
        arrivalTime: as.arrivalTime,
      }));
    }
    const existing = byKey.get(k);
    if (existing) {
      if (isAa1352SavClt(k)) {
        console.log("[Commute Assist] AA1352 SAV→CLT dedupe MERGED (ADB base + AS overlay)", {
          flightKey: k,
          source: "merged",
        });
      }
      byKey.set(k, {
        ...existing,
        dep_scheduled_raw: as.dep_scheduled_raw ?? existing.dep_scheduled_raw,
        dep_estimated_raw: as.dep_estimated_raw ?? existing.dep_estimated_raw,
        dep_actual_raw: as.dep_actual_raw ?? existing.dep_actual_raw,
        arr_scheduled_raw: as.arr_scheduled_raw ?? existing.arr_scheduled_raw,
        arr_estimated_raw: as.arr_estimated_raw ?? existing.arr_estimated_raw,
        arr_actual_raw: as.arr_actual_raw ?? existing.arr_actual_raw,
        dep_delay_min: as.dep_delay_min ?? existing.dep_delay_min,
        arr_delay_min: as.arr_delay_min ?? existing.arr_delay_min,
        status: as.status ?? existing.status,
        dep_gate: as.dep_gate ?? existing.dep_gate,
        arr_gate: as.arr_gate ?? existing.arr_gate,
      });
    } else {
      if (isAa1352SavClt(k)) {
        console.log("[Commute Assist] AA1352 SAV→CLT dedupe AS-only", {
          flightKey: k,
          source: "AS-only",
          departureTime: as.departureTime,
          arrivalTime: as.arrivalTime,
          dep_scheduled_raw: as.dep_scheduled_raw,
          dep_estimated_raw: as.dep_estimated_raw,
          dep_delay_min: as.dep_delay_min,
        });
      }
      byKey.set(k, as);
    }
  }

  const unique = Array.from(byKey.values());
  unique.sort(
    (a, b) =>
      new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
  );
  const aa1352 = unique.find((f) => isAa1352SavClt(flightKey(f)));
  if (aa1352) {
    console.log("[Commute Assist] AA1352 SAV→CLT dedupe FINAL", {
      flightKey: flightKey(aa1352),
      departureTime: aa1352.departureTime,
      arrivalTime: aa1352.arrivalTime,
      dep_scheduled_raw: aa1352.dep_scheduled_raw,
      dep_estimated_raw: aa1352.dep_estimated_raw,
      dep_delay_min: aa1352.dep_delay_min,
      note: "operationalStatus derived after normalize, see next log",
    });
  }
  if (isTpaSju) {
    console.log("[Commute Assist] dedupeFlights TPA→SJU after dedupe", JSON.stringify({
      mergedCount,
      dedupedCount: unique.length,
      keptRows: unique.map((f) => ({
        key: flightKey(f),
        flightNumber: f.flightNumber,
        departureTime: f.departureTime,
        arrivalTime: f.arrivalTime,
      })),
    }));
  }
  return { flights: unique, mergedCount, dedupedCount: unique.length, notice };
}

/** Carrier priority for code-share deduplication. Lower index = prefer when same physical flight. US majors first. */
const CARRIER_PRIORITY: Record<string, number> = {
  DL: 0, AA: 1, UA: 2, AS: 3, B6: 4, WN: 5, F9: 6, NK: 7, G4: 8, SY: 9,
  AC: 10, WS: 11, AM: 12, BA: 13, LH: 14, AF: 15, KL: 16, EK: 17, QR: 18,
};

function carrierPriority(carrier: string): number {
  const c = (carrier ?? "").trim().toUpperCase();
  return CARRIER_PRIORITY[c] ?? 999;
}

/** Filter code-share duplicates: same dep/arr times + route = same flight. Keep main carrier only. */
function filterCodeShareFlights(flights: CommuteFlight[]): CommuteFlight[] {
  const byPhysicalKey = new Map<string, CommuteFlight[]>();
  for (const f of flights) {
    const dep = f.departureTime ?? "";
    const arr = f.arrivalTime ?? "";
    const orig = (f.origin ?? "").toUpperCase();
    const dest = (f.destination ?? "").toUpperCase();
    const key = `${dep}|${arr}|${orig}|${dest}`;
    if (!byPhysicalKey.has(key)) byPhysicalKey.set(key, []);
    byPhysicalKey.get(key)!.push(f);
  }
  const result: CommuteFlight[] = [];
  for (const group of byPhysicalKey.values()) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const best = group.sort((a, b) => carrierPriority(a.carrier) - carrierPriority(b.carrier))[0];
      result.push(best);
    }
  }
  result.sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());
  return result;
}

function monthStartISO(d: Date) {
  const ms = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return ms.toISOString().slice(0, 10);
}

function daysBetween(now: Date, then: Date) {
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

type GetCommuteFlightsSuccess = {
  ok: true;
  source: "api" | "cache";
  flights: CommuteFlight[];
  fetchedAt?: string | null;
  notice?: string;
  originTz: string;
  destTz: string;
  debug?: {
    aviationstackCount?: number;
    aerodataboxCount?: number;
    mergedCount?: number;
    dedupedCount?: number;
    aviationstackFailed?: boolean;
    aerodataboxFailed?: boolean;
    aerodataboxSkipped?: boolean;
    cacheHit?: boolean;
    fetchedAt?: string | null;
  };
};

export async function getCommuteFlights(input: {
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  forceRefresh?: boolean;
  /** When true, skip plan gating (for internal reuse by resolveLegIdentity). */
  skipPlanGating?: boolean;
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

  if (origin === "SAV" && destination === "CLT") {
    console.log("[Commute Assist] AA1352 SAV→CLT getCommuteFlights", {
      forceRefresh: input.forceRefresh,
      source: input.forceRefresh ? "bypassing cache (forceRefresh)" : "will check cache first",
    });
  }

  // When forceRefresh: always hit API (no 10-min cache shortcut) for manual Refresh testing
  if (input.forceRefresh) {
    const { originTz, destTz } = await getRouteTzs(origin, destination);

    // Plan gating for forceRefresh (skip when skipPlanGating, e.g. resolveLegIdentity)
    const isPaid = subscription === "pro" || subscription === "enterprise";
    if (!input.skipPlanGating && !isPaid && accountAgeDays >= 30) {
      return {
        ok: false as const,
        reason: "demo_only" as const,
        message: "Commute Assist is demo-only after 30 days on Free. Upgrade to PRO to refresh live data.",
      };
    }
    if (!input.skipPlanGating && !isPaid && accountAgeDays < 30) {
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
          message: "Free plan limit reached (3 refreshes/month during the first 30 days). Upgrade to PRO for unlimited refresh.",
        };
      }
    }

    try {
      const aerodataboxSkipped = !process.env.RAPIDAPI_KEY;
      const asRes = await safe(() =>
        withTimeout(
          fetchFlightsFromAviationStack(origin, destination, input.date, { noCache: true }),
          PROVIDER_TIMEOUT_MS
        )
      );
      const adbRes = aerodataboxSkipped
        ? { ok: true as const, data: { flights: [] as CommuteFlight[] } }
        : await safe(() =>
            withTimeout(
              fetchFlightsFromAerodataBox(origin, destination, input.date),
              PROVIDER_TIMEOUT_MS
            )
          );

      const aviationstackFlights = asRes.ok ? asRes.data.flights : [];
      const aerodataboxFlights = adbRes.ok ? adbRes.data.flights : [];
      const aviationstackFailed = !asRes.ok;
      const aerodataboxFailed = !adbRes.ok && !aerodataboxSkipped;

      if (aviationstackFailed) console.error("AviationStack failed:", (asRes as { ok: false; error: unknown }).error);
      if (aerodataboxFailed)
        console.error(
          "AeroDataBox failed (continuing with AviationStack):",
          (adbRes as { ok: false; error: unknown }).error
        );

      // Debug: DL 1946 ATL-SJU raw from providers (before dedupe)
      if (origin === "ATL" && destination === "SJU" && process.env.NODE_ENV !== "production") {
        const asDl1946 = aviationstackFlights.filter(
          (f) => (f.carrier === "DL" || f.carrier === "dl") && /1946/.test(f.flightNumber ?? "")
        );
        const adbDl1946 = aerodataboxFlights.filter(
          (f) => (f.carrier === "DL" || f.carrier === "dl") && /1946/.test(f.flightNumber ?? "")
        );
        if (asDl1946.length > 0 || adbDl1946.length > 0) {
          console.log("[Commute Assist] DL 1946 ATL→SJU RAW from providers (before dedupe)", {
            aviationstack: asDl1946.map((f) => ({
              departureTime: f.departureTime,
              arrivalTime: f.arrivalTime,
              dep_scheduled_raw: f.dep_scheduled_raw,
              arr_scheduled_raw: f.arr_scheduled_raw,
              durationMinutes: f.durationMinutes,
            })),
            aerodatabox: adbDl1946.map((f) => ({
              departureTime: f.departureTime,
              arrivalTime: f.arrivalTime,
              dep_scheduled_raw: f.dep_scheduled_raw,
              arr_scheduled_raw: f.arr_scheduled_raw,
              durationMinutes: f.durationMinutes,
            })),
          });
        }
      }

      const merged = dedupeFlights(
        aviationstackFlights,
        aerodataboxFlights,
        asRes.ok ? asRes.data.notice : undefined,
        origin,
        destination
      );
      const deduped = filterCodeShareFlights(merged.flights);
      const flights = deduped.map((f) => {
        const normalized = normalizeFlightTiming(f, originTz, destTz);
        const isAa1352SavClt =
          normalized.carrier === "AA" &&
          /1352/.test(normalized.flightNumber ?? "") &&
          normalized.origin === "SAV" &&
          normalized.destination === "CLT";
        const operationalStatus = deriveOperationalStatus(
          {
            depUtc: normalized.departureTime,
            arrUtc: normalized.arrivalTime,
            originTz: normalized.origin_tz ?? originTz,
            destTz: normalized.dest_tz ?? destTz,
            dep_scheduled_raw: normalized.dep_scheduled_raw,
            dep_estimated_raw: normalized.dep_estimated_raw,
            dep_actual_raw: normalized.dep_actual_raw,
            arr_scheduled_raw: normalized.arr_scheduled_raw,
            arr_estimated_raw: normalized.arr_estimated_raw,
            arr_actual_raw: normalized.arr_actual_raw,
            dep_delay_min: normalized.dep_delay_min,
            arr_delay_min: normalized.arr_delay_min,
            status: normalized.status,
            _debug: isAa1352SavClt
              ? {
                  carrier: normalized.carrier,
                  flightNumber: normalized.flightNumber ?? "",
                  origin: normalized.origin,
                  destination: normalized.destination,
                }
              : undefined,
          },
          originTz,
          destTz
        );
        return { ...normalized, operationalStatus };
      });
      const aa1352Final = flights.find(
        (f) =>
          (f.carrier === "AA" && /1352/.test(f.flightNumber ?? "") && f.origin === "SAV" && f.destination === "CLT")
      );
      if (aa1352Final && origin === "SAV" && destination === "CLT") {
        console.log("[Commute Assist] AA1352 SAV→CLT FINAL (from API)", {
          departureTime: aa1352Final.departureTime,
          arrivalTime: aa1352Final.arrivalTime,
          dep_scheduled_raw: aa1352Final.dep_scheduled_raw,
          dep_estimated_raw: aa1352Final.dep_estimated_raw,
          dep_delay_min: aa1352Final.dep_delay_min,
          operationalStatus: aa1352Final.operationalStatus?.label,
        });
      }
      const dl1946AtlSju = flights.find(
        (f) =>
          origin === "ATL" &&
          destination === "SJU" &&
          (f.carrier === "DL" || f.carrier === "dl") &&
          /1946/.test(f.flightNumber ?? "")
      );
      if (dl1946AtlSju && process.env.NODE_ENV !== "production") {
        console.log("[Commute Assist] DL 1946 ATL→SJU FINAL (from API)", {
          departureTime: dl1946AtlSju.departureTime,
          arrivalTime: dl1946AtlSju.arrivalTime,
          durationMinutes: dl1946AtlSju.durationMinutes,
        });
      }
      const { notice } = merged;

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
      if (upsertErr)
        console.error("Commute cache upsert failed", {
          code: (upsertErr as { code?: string }).code,
          message: (upsertErr as { message?: string }).message,
          details: (upsertErr as { details?: string }).details,
          hint: (upsertErr as { hint?: string }).hint,
        });

      if (!isPaid && accountAgeDays < 30) {
        const msISO = monthStartISO(now);
        const { error: rpcErr } = await admin.rpc("increment_commute_refresh_usage", {
          p_tenant: tenant,
          p_user_id: userId,
          p_month_start: msISO,
        });
        if (rpcErr) console.error("increment_commute_refresh_usage failed", rpcErr);
      }

      const debug =
        process.env.NODE_ENV !== "production"
          ? {
              aviationstackCount: aviationstackFlights.length,
              aerodataboxCount: aerodataboxFlights.length,
              mergedCount: merged.mergedCount,
              dedupedCount: merged.dedupedCount,
              aviationstackFailed,
              aerodataboxFailed,
              aerodataboxSkipped,
              cacheHit: false,
            }
          : undefined;

      return { ok: true as const, source: "api" as const, flights, fetchedAt: now.toISOString(), notice, originTz, destTz, debug };
    } catch (err) {
      console.error("Commute Assist failed", err);
      return { ok: false as const, reason: "unavailable" as const, message: "Commute Assist temporarily unavailable." };
    }
  }

  // 1) Cache-first (return if exists) — only v2 entries
  const { data: cached, error: cacheErr } = await admin
    .from("commute_flight_cache")
    .select("data, fetched_at")
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

  if (cached?.data && !input.forceRefresh) {
    const { originTz, destTz } = await getRouteTzs(origin, destination);
    const cachedFlights = filterCodeShareFlights(cached.data as CommuteFlight[]);
    // Re-derive operationalStatus on cache read; do not trust cached value (DERIVED_STATUS_VERSION).
    const flights = cachedFlights.map((f) => {
      const normalized = normalizeFlightTiming(f, originTz, destTz);
      const isAa1352SavClt =
        normalized.carrier === "AA" &&
        /1352/.test(normalized.flightNumber ?? "") &&
        normalized.origin === "SAV" &&
        normalized.destination === "CLT";
      const operationalStatus = deriveOperationalStatus(
        {
          depUtc: normalized.departureTime,
          arrUtc: normalized.arrivalTime,
          originTz: normalized.origin_tz ?? originTz,
          destTz: normalized.dest_tz ?? destTz,
          dep_scheduled_raw: normalized.dep_scheduled_raw,
          dep_estimated_raw: normalized.dep_estimated_raw,
          dep_actual_raw: normalized.dep_actual_raw,
          arr_scheduled_raw: normalized.arr_scheduled_raw,
          arr_estimated_raw: normalized.arr_estimated_raw,
          arr_actual_raw: normalized.arr_actual_raw,
          dep_delay_min: normalized.dep_delay_min,
          arr_delay_min: normalized.arr_delay_min,
          status: normalized.status,
          _debug: isAa1352SavClt
            ? {
                carrier: normalized.carrier,
                flightNumber: normalized.flightNumber ?? "",
                origin: normalized.origin,
                destination: normalized.destination,
              }
            : undefined,
        },
        originTz,
        destTz
      );
      return { ...normalized, operationalStatus };
    });
    if (origin === "SAV" && destination === "CLT") {
      const aa1352Cached = flights.find(
        (f) =>
          (f.carrier === "AA" && /1352/.test(f.flightNumber ?? "") && f.origin === "SAV" && f.destination === "CLT")
      );
      if (aa1352Cached) {
        console.log("[Commute Assist] AA1352 SAV→CLT reading from CACHE", {
          departureTime: aa1352Cached.departureTime,
          arrivalTime: aa1352Cached.arrivalTime,
          dep_scheduled_raw: aa1352Cached.dep_scheduled_raw,
          dep_estimated_raw: aa1352Cached.dep_estimated_raw,
          dep_delay_min: aa1352Cached.dep_delay_min,
          operationalStatus: aa1352Cached.operationalStatus?.label,
          fetched_at: cached.fetched_at,
        });
      }
    }
    if (origin === "ATL" && destination === "SJU" && process.env.NODE_ENV !== "production") {
      const dl1946Cached = flights.find(
        (f) =>
          (f.carrier === "DL" || f.carrier === "dl") &&
          /1946/.test(f.flightNumber ?? "") &&
          f.origin === "ATL" &&
          f.destination === "SJU"
      );
      if (dl1946Cached) {
        console.log("[Commute Assist] DL 1946 ATL→SJU reading from CACHE", {
          departureTime: dl1946Cached.departureTime,
          arrivalTime: dl1946Cached.arrivalTime,
          durationMinutes: dl1946Cached.durationMinutes,
          fetched_at: cached.fetched_at,
        });
      }
    }
    if (origin === "TPA" && destination === "SJU") {
      console.log("[Commute Assist] TPA→SJU from DB cache (no dedupe)", JSON.stringify({
        source: "commute_flight_cache",
        flightCount: flights?.length ?? 0,
        rows: flights?.map((f) => ({
          key: flightKey(f),
          flightNumber: f.flightNumber,
          departureTime: f.departureTime,
          arrivalTime: f.arrivalTime,
        })),
      }));
    }
    return {
      ok: true as const,
      source: "cache" as const,
      flights,
      fetchedAt: cached.fetched_at ?? null,
      notice: undefined,
      originTz,
      destTz,
      debug:
        process.env.NODE_ENV !== "production"
          ? {
              cacheHit: true,
              fetchedAt: cached.fetched_at ?? null,
            }
          : undefined,
    };
  }

  // 2) Plan gating (cache miss) — skip when skipPlanGating, e.g. resolveLegIdentity
  const isPaid = subscription === "pro" || subscription === "enterprise";

  if (!input.skipPlanGating && !isPaid && accountAgeDays >= 30) {
    return {
      ok: false as const,
      reason: "demo_only" as const,
      message: "Commute Assist is demo-only after 30 days on Free. Upgrade to PRO to refresh live data.",
    };
  }

  if (!input.skipPlanGating && !isPaid && accountAgeDays < 30) {
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
        message: "Free plan limit reached (3 refreshes/month during the first 30 days). Upgrade to PRO for unlimited refresh.",
      };
    }
  }

  // 3) Hit both providers (cache miss) — AeroDataBox after AviationStack to avoid parallel ADB calls across routes
  try {
    const { originTz, destTz } = await getRouteTzs(origin, destination);
    const aerodataboxSkipped = !process.env.RAPIDAPI_KEY;
    const asRes = await safe(() =>
      withTimeout(
        fetchFlightsFromAviationStack(origin, destination, input.date),
        PROVIDER_TIMEOUT_MS
      )
    );
    const adbRes = aerodataboxSkipped
      ? { ok: true as const, data: { flights: [] as CommuteFlight[] } }
      : await safe(() =>
          withTimeout(
            fetchFlightsFromAerodataBox(origin, destination, input.date),
            PROVIDER_TIMEOUT_MS
          )
        );

    const aviationstackFlights = asRes.ok ? asRes.data.flights : [];
    const aerodataboxFlights = adbRes.ok ? adbRes.data.flights : [];
    const aviationstackFailed = !asRes.ok;
    const aerodataboxFailed = !adbRes.ok && !aerodataboxSkipped;

    if (aviationstackFailed) console.error("AviationStack failed:", (asRes as { ok: false; error: unknown }).error);
    if (aerodataboxFailed)
      console.error(
        "AeroDataBox failed (continuing with AviationStack):",
        (adbRes as { ok: false; error: unknown }).error
      );

    const merged = dedupeFlights(
      aviationstackFlights,
      aerodataboxFlights,
      asRes.ok ? asRes.data.notice : undefined,
      origin,
      destination
    );
    const deduped = filterCodeShareFlights(merged.flights);
    const flights = deduped.map((f) => {
      const normalized = normalizeFlightTiming(f, originTz, destTz);
      const isAa1352SavClt =
        normalized.carrier === "AA" &&
        /1352/.test(normalized.flightNumber ?? "") &&
        normalized.origin === "SAV" &&
        normalized.destination === "CLT";
      const operationalStatus = deriveOperationalStatus(
        {
          depUtc: normalized.departureTime,
          arrUtc: normalized.arrivalTime,
          originTz: normalized.origin_tz ?? originTz,
          destTz: normalized.dest_tz ?? destTz,
          dep_scheduled_raw: normalized.dep_scheduled_raw,
          dep_estimated_raw: normalized.dep_estimated_raw,
          dep_actual_raw: normalized.dep_actual_raw,
          arr_scheduled_raw: normalized.arr_scheduled_raw,
          arr_estimated_raw: normalized.arr_estimated_raw,
          arr_actual_raw: normalized.arr_actual_raw,
          dep_delay_min: normalized.dep_delay_min,
          arr_delay_min: normalized.arr_delay_min,
          status: normalized.status,
          _debug: isAa1352SavClt
            ? {
                carrier: normalized.carrier,
                flightNumber: normalized.flightNumber ?? "",
                origin: normalized.origin,
                destination: normalized.destination,
              }
            : undefined,
        },
        originTz,
        destTz
      );
      return { ...normalized, operationalStatus };
    });
    const aa1352FinalMiss = flights.find(
      (f) =>
        (f.carrier === "AA" && /1352/.test(f.flightNumber ?? "") && f.origin === "SAV" && f.destination === "CLT")
    );
    if (aa1352FinalMiss && origin === "SAV" && destination === "CLT") {
      console.log("[Commute Assist] AA1352 SAV→CLT FINAL (from API, cache miss)", {
        departureTime: aa1352FinalMiss.departureTime,
        arrivalTime: aa1352FinalMiss.arrivalTime,
        dep_scheduled_raw: aa1352FinalMiss.dep_scheduled_raw,
        dep_estimated_raw: aa1352FinalMiss.dep_estimated_raw,
        dep_delay_min: aa1352FinalMiss.dep_delay_min,
        operationalStatus: aa1352FinalMiss.operationalStatus?.label,
      });
    }
    const dl1946Miss = flights.find(
      (f) =>
        origin === "ATL" &&
        destination === "SJU" &&
        (f.carrier === "DL" || f.carrier === "dl") &&
        /1946/.test(f.flightNumber ?? "")
    );
    if (dl1946Miss && process.env.NODE_ENV !== "production") {
      console.log("[Commute Assist] DL 1946 ATL→SJU FINAL (from API, cache miss)", {
        departureTime: dl1946Miss.departureTime,
        arrivalTime: dl1946Miss.arrivalTime,
        durationMinutes: dl1946Miss.durationMinutes,
      });
    }
    const { notice } = merged;

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
    if (upsertErr)
      console.error("Commute cache upsert failed", {
        code: (upsertErr as { code?: string }).code,
        message: (upsertErr as { message?: string }).message,
        details: (upsertErr as { details?: string }).details,
        hint: (upsertErr as { hint?: string }).hint,
      });

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

    const debug =
      process.env.NODE_ENV !== "production"
        ? {
            aviationstackCount: aviationstackFlights.length,
            aerodataboxCount: aerodataboxFlights.length,
            mergedCount: merged.mergedCount,
            dedupedCount: merged.dedupedCount,
            aviationstackFailed,
            aerodataboxFailed,
            aerodataboxSkipped,
            cacheHit: false,
          }
        : undefined;

    return { ok: true as const, source: "api" as const, flights, fetchedAt: now.toISOString(), notice, originTz, destTz, debug };
  } catch (err) {
    console.error("Commute Assist failed", err);
    return { ok: false as const, reason: "unavailable" as const, message: "Commute Assist temporarily unavailable." };
  }
}
