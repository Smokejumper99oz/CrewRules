import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AIRCRAFT_HERO_BUCKET,
  getAircraftHeroImageFallback,
  getAircraftHeroImagePath,
  isSafeAircraftHeroPathSegment,
  type AircraftHeroImagePathParams,
} from "./aircraft-hero-image";

/**
 * Builds the public Storage URL for an object path (does not verify the object exists).
 */
export function getAircraftHeroStoragePublicUrl(
  supabase: SupabaseClient,
  params: AircraftHeroImagePathParams,
): string | null {
  try {
    const path = getAircraftHeroImagePath(params);
    const { data } = supabase.storage.from(AIRCRAFT_HERO_BUCKET).getPublicUrl(path);
    const url = data?.publicUrl?.trim();
    if (!url) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Resolves the image `src` for a tenant/tail hero: public Storage URL if the object is readable, else {@link getAircraftHeroImageFallback}.
 * Safe to call from Server Components / Route Handlers (pass server `SupabaseClient`).
 */
export async function resolveAircraftHeroImageUrl(
  supabase: SupabaseClient,
  params: { tenant?: string | null; tailNumber?: string | null },
): Promise<string> {
  const tenant = params.tenant?.trim() ?? "";
  const tailNumber = params.tailNumber?.trim() ?? "";
  if (!tenant || !tailNumber || !isSafeAircraftHeroPathSegment(tenant) || !isSafeAircraftHeroPathSegment(tailNumber)) {
    return getAircraftHeroImageFallback();
  }

  const publicUrl = getAircraftHeroStoragePublicUrl(supabase, { tenant, tailNumber });
  if (!publicUrl) {
    return getAircraftHeroImageFallback();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return getAircraftHeroImageFallback();
  }

  try {
    const res = await fetch(publicUrl, { method: "HEAD", next: { revalidate: 300 } });
    if (!res.ok) {
      return getAircraftHeroImageFallback();
    }
  } catch {
    return getAircraftHeroImageFallback();
  }

  return publicUrl;
}
