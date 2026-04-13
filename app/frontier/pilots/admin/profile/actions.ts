"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { formatUsPhoneDisplay } from "@/lib/format-us-phone";

export type UpdateAdminProfileBasicsResult = { success: true } | { error: string };

/**
 * Updates only full_name and phone for the signed-in user (admin profile).
 * Does not use updateProfilePreferences — that action requires full pilot settings payload.
 */
export async function updateAdminProfileBasics(
  formData: FormData
): Promise<UpdateAdminProfileBasicsResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const fullNameRaw = (formData.get("full_name") as string)?.trim() ?? "";
  const fullName = fullNameRaw === "" ? null : fullNameRaw;
  const phoneRaw = (formData.get("phone") as string)?.trim() ?? "";
  const phone = phoneRaw === "" ? null : formatUsPhoneDisplay(phoneRaw);

  if (fullName && fullName.length > 128) {
    return { error: "Full Name is too long" };
  }
  if (phone != null && phone.length > 64) {
    return { error: "Phone is too long" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/admin/profile");
  revalidatePath("/frontier/pilots/portal");
  revalidatePath("/frontier/pilots/portal/settings", "layout");
  return { success: true };
}
