"use server";

import { revalidatePath } from "next/cache";
import {
  AIRCRAFT_HERO_BUCKET,
  AIRCRAFT_HERO_IMAGE_SPECS,
  getAircraftHeroImagePath,
  isSafeAircraftHeroPathSegment,
} from "@/lib/ops/aircraft-hero-image";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";

function isDemo135OpsTenantAdmin(profile: {
  role: string | null;
  tenant: string | null;
  portal: string | null;
}): boolean {
  return (
    profile.role === "tenant_admin" &&
    profile.tenant === "demo135" &&
    profile.portal === "ops"
  );
}

const ALLOWED = new Set<string>(AIRCRAFT_HERO_IMAGE_SPECS.allowedMimeTypes);

export type UploadAircraftHeroResult = { ok: true } | { ok: false; error: string };

/**
 * Uploads a hero image for the demo135 ops pilot preview (Storage path per tenant + tail).
 * Caller must be signed in as super admin or demo135 ops tenant admin (same as layout).
 */
export async function uploadDemo135AircraftHeroAction(formData: FormData): Promise<UploadAircraftHeroResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const email = (user.email ?? "").toLowerCase().trim();
  const allowlisted = isSuperAdminAllowlistedEmail(email);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, tenant, portal")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, error: "Profile not found." };
  }

  const isSuperAdmin = profile.role === "super_admin" || allowlisted;
  if (!isSuperAdmin && !isDemo135OpsTenantAdmin(profile)) {
    return { ok: false, error: "Not allowed to upload." };
  }

  const tenant = String(formData.get("tenant") ?? "").trim();
  const tailNumber = String(formData.get("tailNumber") ?? "").trim();

  if (
    !tenant ||
    !tailNumber ||
    !isSafeAircraftHeroPathSegment(tenant) ||
    !isSafeAircraftHeroPathSegment(tailNumber)
  ) {
    return { ok: false, error: "Invalid tenant or aircraft." };
  }

  // RLS for operator-assets is scoped to demo135 paths; keep server-side aligned.
  if (tenant !== "demo135") {
    return { ok: false, error: "Upload is only enabled for the demo tenant." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file." };
  }

  if (file.size > AIRCRAFT_HERO_IMAGE_SPECS.maxFileBytes) {
    return { ok: false, error: `Image must be under ${AIRCRAFT_HERO_IMAGE_SPECS.maxFileBytes / (1024 * 1024)} MB.` };
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return { ok: false, error: "Use JPEG, PNG, or WebP." };
  }

  const path = getAircraftHeroImagePath({ tenant, tailNumber });
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(AIRCRAFT_HERO_BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: mime,
    cacheControl: "3600",
  });

  if (uploadError) {
    return { ok: false, error: uploadError.message || "Upload failed." };
  }

  revalidatePath("/demo135/ops/admin");
  return { ok: true };
}

/**
 * Removes the tail hero from Storage so the UI falls back to the static demo asset (see getAircraftHeroImageFallback).
 * Same auth rules as uploadDemo135AircraftHeroAction.
 */
export async function resetDemo135AircraftHeroAction(
  tenant: string,
  tailNumber: string,
): Promise<UploadAircraftHeroResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const email = (user.email ?? "").toLowerCase().trim();
  const allowlisted = isSuperAdminAllowlistedEmail(email);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, tenant, portal")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, error: "Profile not found." };
  }

  const isSuperAdmin = profile.role === "super_admin" || allowlisted;
  if (!isSuperAdmin && !isDemo135OpsTenantAdmin(profile)) {
    return { ok: false, error: "Not allowed." };
  }

  const t = tenant.trim();
  const tail = tailNumber.trim();
  if (!t || !tail || !isSafeAircraftHeroPathSegment(t) || !isSafeAircraftHeroPathSegment(tail)) {
    return { ok: false, error: "Invalid tenant or aircraft." };
  }

  if (t !== "demo135") {
    return { ok: false, error: "Reset is only enabled for the demo tenant." };
  }

  const path = getAircraftHeroImagePath({ tenant: t, tailNumber: tail });
  const { error: removeError } = await supabase.storage.from(AIRCRAFT_HERO_BUCKET).remove([path]);

  if (removeError) {
    return { ok: false, error: removeError.message || "Could not remove image." };
  }

  revalidatePath("/demo135/ops/admin");
  return { ok: true };
}
