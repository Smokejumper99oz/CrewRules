import { createAdminClient } from "@/lib/supabase/admin";

function isBlank(s: string | null | undefined): boolean {
  return s == null || String(s).trim() === "";
}

/**
 * Claim a preloaded mentor roster row when the profile's employee_number + tenant match.
 * Uses service role because mentor_preload RLS is admin-only.
 * Idempotent: only rows with matched_profile_id IS NULL; mentor_phone / mentor_contact_email only when blank.
 */
export async function linkMentorToPreload(
  profileId: string,
  employeeNumber: string,
  tenant: string
): Promise<number> {
  const emp = employeeNumber?.trim();
  const ten = tenant?.trim();
  if (!emp || !ten) return 0;

  const admin = createAdminClient();

  const { data: preload, error: selErr } = await admin
    .from("mentor_preload")
    .select("id, phone, personal_email, work_email")
    .eq("tenant", ten)
    .eq("employee_number", emp)
    .is("matched_profile_id", null)
    .eq("active", true)
    .maybeSingle();

  if (selErr || !preload?.id) return 0;

  const nowIso = new Date().toISOString();

  const { data: claimed, error: updPreloadErr } = await admin
    .from("mentor_preload")
    .update({ matched_profile_id: profileId, updated_at: nowIso })
    .eq("id", preload.id)
    .is("matched_profile_id", null)
    .select("id")
    .maybeSingle();

  if (updPreloadErr || !claimed?.id) return 0;

  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("mentor_phone, mentor_contact_email")
    .eq("id", profileId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    is_mentor: true,
    updated_at: nowIso,
  };

  if (!profErr && prof) {
    const preloadPhone = (preload.phone as string | null)?.trim() ?? "";
    if (isBlank(prof.mentor_phone as string | null | undefined) && preloadPhone) {
      patch.mentor_phone = preloadPhone;
    }

    const personal = (preload.personal_email as string | null)?.trim() ?? "";
    const work = (preload.work_email as string | null)?.trim() ?? "";
    const preloadContactEmail = personal || work;
    if (isBlank(prof.mentor_contact_email as string | null | undefined) && preloadContactEmail) {
      patch.mentor_contact_email = preloadContactEmail;
    }
  }

  const { error: patchErr } = await admin.from("profiles").update(patch).eq("id", profileId);
  if (patchErr) {
    console.error("[linkMentorToPreload] profile update failed", patchErr);
  }

  return 1;
}
