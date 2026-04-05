"use server";



import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

import { createAdminClient } from "@/lib/supabase/admin";

import { getProfile } from "@/lib/profile";

import type { Profile } from "@/lib/profile";

import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";

import { sendFeedbackNotificationEmail } from "@/lib/email/send-feedback-notification";



/** Matches `app/frontier/pilots/portal/layout.tsx` — this action is only for the Frontier pilot portal tree. */

const PORTAL_TENANT = "frontier";

const PORTAL = "pilots";

/** When no session; aligns with product line for ops filtering (route_path shows exact page). */
const PUBLIC_SITE_FEEDBACK_TENANT = PORTAL_TENANT;

const PUBLIC_SITE_FEEDBACK_PORTAL = PORTAL;



/** Same roles as `PORTAL_ALLOWED_ROLES.pilots` in `lib/portal-gate.ts`. */

const FRONTIER_PILOTS_PORTAL_ROLES = ["super_admin", "tenant_admin", "pilot"] as const;



const FEEDBACK_TYPES = new Set(["bug", "feature", "feedback"]);



const MAX_MESSAGE_LENGTH = 20_000;

const MAX_ROUTE_PATH_LENGTH = 2048;

const MAX_CLIENT_CONTEXT_JSON_CHARS = 16_000;



const FEEDBACK_SCREENSHOTS_BUCKET = "feedback-screenshots";

const MAX_SCREENSHOT_FILES = 4;

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

/** Matches client `portal-feedback-modal` acceptance rules (MIME + extension fallback). */
const ALLOWED_SCREENSHOT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/pjpeg",
  "image/jpg",
]);



export type SubmitFeedbackResult =

  | { success: true; attachments_saved?: number }

  | { success: false; error: string };



function isAuthorizedToSubmitFeedback(profile: Profile, authEmail: string | undefined): boolean {

  if (profile.role === "super_admin") return true;

  if (isSuperAdminAllowlistedEmail(authEmail ?? "")) return true;

  if (profile.tenant !== PORTAL_TENANT || profile.portal !== PORTAL) return false;

  return (FRONTIER_PILOTS_PORTAL_ROLES as readonly string[]).includes(profile.role);

}



function toClientContextJsonb(raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {

  if (raw == null) return { ok: true, value: undefined };

  if (typeof raw !== "object") {

    return { ok: false, error: "Invalid client context" };

  }

  let s: string;

  try {

    s = JSON.stringify(raw);

  } catch {

    return { ok: false, error: "Invalid client context" };

  }

  if (s.length > MAX_CLIENT_CONTEXT_JSON_CHARS) {

    return { ok: false, error: "Client context is too large" };

  }

  return { ok: true, value: JSON.parse(s) as unknown };

}



function sanitizeTenantForPath(tenant: string): string {

  const t = tenant.trim().replace(/[^a-zA-Z0-9._-]/g, "_");

  return t.length > 0 ? t.slice(0, 64) : "tenant";

}



const MAX_CONTACT_EMAIL_LENGTH = 320;



/** Optional public contact email; empty -> null. Only used when submitter is anonymous. */

function parseOptionalContactEmail(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {

  if (raw == null || String(raw).trim() === "") {

    return { ok: true, value: null };

  }

  const s = String(raw).trim();

  if (s.length > MAX_CONTACT_EMAIL_LENGTH) {

    return { ok: false, error: "Email is too long" };

  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {

    return { ok: false, error: "Please enter a valid email address" };

  }

  return { ok: true, value: s };

}



function isAllowedScreenshotFile(f: File): boolean {

  const mime = f.type.trim().toLowerCase();

  if (ALLOWED_SCREENSHOT_TYPES.has(mime)) return true;

  const name = f.name.trim().toLowerCase();

  return /\.(png|jpe?g|webp)$/.test(name);

}



/** Storage path extension + Content-Type for upload/DB (handles empty or non-canonical browser MIME). */

function resolveScreenshotUploadMeta(f: File): { ext: string; contentType: string } | null {

  const mime = f.type.trim().toLowerCase();

  if (mime === "image/png") return { ext: "png", contentType: "image/png" };

  if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/pjpeg") {

    return { ext: "jpg", contentType: "image/jpeg" };

  }

  if (mime === "image/webp") return { ext: "webp", contentType: "image/webp" };

  const name = f.name.trim().toLowerCase();

  if (name.endsWith(".png")) return { ext: "png", contentType: "image/png" };

  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return { ext: "jpg", contentType: "image/jpeg" };

  if (name.endsWith(".webp")) return { ext: "webp", contentType: "image/webp" };

  return null;

}



/**

 * Validates optional screenshot files before the feedback row is inserted.

 * Rejects empty files, wrong types, oversize, or more than four files.

 */

function validateScreenshotFiles(raw: unknown): { ok: true; files: File[] } | { ok: false; error: string } {

  if (raw == null) return { ok: true, files: [] };

  if (!Array.isArray(raw)) {

    return { ok: false, error: "Invalid screenshots payload" };

  }

  const files = raw.filter((x): x is File => x instanceof File);

  if (files.length !== raw.length) {

    return { ok: false, error: "Invalid screenshot file" };

  }

  if (files.length === 0) return { ok: true, files: [] };

  if (files.length > MAX_SCREENSHOT_FILES) {

    return { ok: false, error: `At most ${MAX_SCREENSHOT_FILES} screenshots` };

  }

  for (const f of files) {

    if (f.size === 0) {

      return { ok: false, error: "Screenshot file is empty" };

    }

    if (f.size > MAX_SCREENSHOT_BYTES) {

      return { ok: false, error: "Each screenshot must be 10 MB or smaller" };

    }

    if (!isAllowedScreenshotFile(f)) {

      return {
        ok: false,
        error: "Screenshots must be PNG, JPEG, or WebP (.png, .jpg, .jpeg, .webp).",
      };

    }

  }

  return { ok: true, files };

}



/**

 * Persists one row to `public.feedback_submissions` using the service role.

 * Signed-in: profile must be authorized for the Frontier pilot portal (or platform super admin / allowlist).
 * Unsigned: allowed for public marketing pages; stored with null submitter and default tenant/portal.

 */

export async function submitFeedback(params: {

  feedback_type: string;

  message: string;

  route_path?: string | null;

  client_context?: unknown;

  /** Optional; max 4 images. Omit or empty when not used (e.g. until portal UI sends files). */

  screenshots?: File[] | null;

  /** Logged-out submissions only; ignored when a session exists. */

  contact_email?: string | null;

}): Promise<SubmitFeedbackResult> {

  const supabase = await createClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  const screenshotsCheck = validateScreenshotFiles(params.screenshots ?? null);

  if (!screenshotsCheck.ok) {

    return { success: false, error: screenshotsCheck.error };

  }

  const screenshotFiles = screenshotsCheck.files;



  const feedbackType = typeof params.feedback_type === "string" ? params.feedback_type.trim() : "";

  if (!FEEDBACK_TYPES.has(feedbackType)) {

    return { success: false, error: "Invalid feedback type" };

  }



  const message = typeof params.message === "string" ? params.message.trim() : "";

  if (!message) {

    return { success: false, error: "Please enter a message" };

  }

  if (message.length > MAX_MESSAGE_LENGTH) {

    return { success: false, error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` };

  }



  let routePath: string | null = null;

  if (params.route_path != null && String(params.route_path).trim() !== "") {

    const rp = String(params.route_path).trim();

    if (rp.length > MAX_ROUTE_PATH_LENGTH) {

      return { success: false, error: "Route path is too long" };

    }

    routePath = rp;

  }



  const ctxParsed = toClientContextJsonb(params.client_context);

  if (!ctxParsed.ok) {

    return { success: false, error: ctxParsed.error };

  }



  let contactEmailForRow: string | null = null;

  if (!user) {

    const contactParsed = parseOptionalContactEmail(params.contact_email ?? null);

    if (!contactParsed.ok) {

      return { success: false, error: contactParsed.error };

    }

    contactEmailForRow = contactParsed.value;

  }



  let submitterUserId: string | null;

  let profileId: string | null;

  let submitterEmail: string | null;

  let submitterFullName: string | null;

  let tenant: string;

  let portal: string;

  if (user) {

    const profile = await getProfile();

    if (!profile) {

      return { success: false, error: "Profile not found" };

    }

    if (!isAuthorizedToSubmitFeedback(profile, user.email)) {

      return { success: false, error: "Not allowed to submit feedback" };

    }

    submitterUserId = user.id;

    profileId = profile.id;

    submitterEmail =

      (profile.email != null && String(profile.email).trim() !== ""

        ? String(profile.email).trim()

        : null) ??

      (user.email != null && user.email.trim() !== "" ? user.email.trim() : null);

    submitterFullName =

      profile.full_name != null && String(profile.full_name).trim() !== ""

        ? String(profile.full_name).trim()

        : null;

    tenant = profile.tenant;

    portal = profile.portal;

  } else {

    submitterUserId = null;

    profileId = null;

    submitterEmail = null;

    submitterFullName = null;

    tenant = PUBLIC_SITE_FEEDBACK_TENANT;

    portal = PUBLIC_SITE_FEEDBACK_PORTAL;

  }

  const admin = createAdminClient();

  const { data: inserted, error } = await admin

    .from("feedback_submissions")

    .insert({

      feedback_type: feedbackType,

      message,

      submitter_user_id: submitterUserId,

      profile_id: profileId,

      submitter_email: submitterEmail,

      submitter_full_name: submitterFullName,

      tenant,

      portal,

      route_path: routePath,

      client_context: ctxParsed.value ?? null,

      contact_email: contactEmailForRow,

    })

    .select("id, created_at")

    .single();



  if (error) {

    console.error("[submitFeedback] insert failed:", error.message);

    return { success: false, error: "Could not save feedback. Please try again." };

  }



  const submissionId = inserted?.id as string;

  if (!submissionId) {

    console.error("[submitFeedback] insert returned no id");

    return { success: false, error: "Could not save feedback. Please try again." };

  }



  const createdAt = inserted?.created_at ?? new Date().toISOString();

  const tenantSlug = sanitizeTenantForPath(tenant);



  let attachmentsSaved = 0;

  for (let i = 0; i < screenshotFiles.length; i++) {

    const file = screenshotFiles[i]!;

    const meta = resolveScreenshotUploadMeta(file);

    if (!meta) {

      console.error("[submitFeedback] unexpected file after validate:", file.name, file.type);

      continue;

    }

    const { ext, contentType } = meta;

    const uid = randomUUID();

    const storagePath = `${tenantSlug}/${submissionId}/${i}_${uid}.${ext}`;



    const { error: upErr } = await admin.storage.from(FEEDBACK_SCREENSHOTS_BUCKET).upload(storagePath, file, {

      contentType,

      cacheControl: "3600",

      upsert: false,

    });



    if (upErr) {

      console.error("[submitFeedback] screenshot upload failed:", storagePath, upErr.message);

      continue;

    }



    const { error: rowErr } = await admin.from("feedback_submission_attachments").insert({

      feedback_submission_id: submissionId,

      storage_bucket: FEEDBACK_SCREENSHOTS_BUCKET,

      storage_path: storagePath,

      mime_type: contentType,

      byte_size: file.size,

      sort_order: i,

    });



    if (rowErr) {

      console.error("[submitFeedback] attachment row insert failed:", rowErr.message);

      await admin.storage

        .from(FEEDBACK_SCREENSHOTS_BUCKET)

        .remove([storagePath])

        .catch(() => {});

      continue;

    }



    attachmentsSaved++;

  }



  const notify = await sendFeedbackNotificationEmail({

    feedback_type: feedbackType,

    message,

    submitter_full_name: submitterFullName,

    submitter_email: submitterEmail,

    contact_email: contactEmailForRow,

    tenant,

    portal,

    route_path: routePath,

    created_at: createdAt,

    attachment_count: attachmentsSaved,

  });

  if (!notify.ok) {

    console.error("[submitFeedback] notification email failed:", notify.error);

  }



  return {

    success: true,

    ...(screenshotFiles.length > 0 ? { attachments_saved: attachmentsSaved } : {}),

  };

}


