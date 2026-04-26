import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AIRCRAFT_HERO_BUCKET,
  getAircraftHeroImageFallback,
  getAircraftHeroImagePath,
  isSafeAircraftHeroPathSegment,
  type AircraftHeroImagePathParams,
} from "./aircraft-hero-image";

const HERO_FILE_NAME = "hero.jpg";

function heroStorageFolderPath(tenant: string, tailNumber: string): string {
  return `tenants/${tenant}/aircraft/${tailNumber}`;
}

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
 * Resolves the image `src` for a tenant/tail hero: public Storage URL if the object exists, else {@link getAircraftHeroImageFallback}.
 * Uses Storage `list` with the authenticated server client (see migration `166_operator_assets_authenticated_select.sql`)
 * so we do not rely on HTTP HEAD, which can fail or disagree with reality on public bucket URLs.
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

  const folder = heroStorageFolderPath(tenant, tailNumber);
  try {
    const { data, error } = await supabase.storage.from(AIRCRAFT_HERO_BUCKET).list(folder, {
      limit: 32,
    });
    if (error) {
      return getAircraftHeroImageFallback();
    }
    const hasHero = data?.some((f) => f.name === HERO_FILE_NAME) ?? false;
    if (!hasHero) {
      return getAircraftHeroImageFallback();
    }
  } catch {
    return getAircraftHeroImageFallback();
  }

  return publicUrl;
}
