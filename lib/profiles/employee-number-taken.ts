import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_EMPLOYEE_NUMBER_TAKEN_ERROR =
  "This employee number is already connected to another CrewRules account.";

/** Same trim semantics as partial unique index: btrim(employee_number). */
export async function isProfileEmployeeNumberTaken(
  client: SupabaseClient,
  params: {
    tenant: string;
    portal: string;
    employeeNumberTrimmed: string;
    excludeProfileId: string | null;
  }
): Promise<{ error?: string; taken: boolean }> {
  const emp = params.employeeNumberTrimmed.trim();
  if (!emp) return { taken: false };

  const { data, error } = await client.rpc("profiles_employee_number_is_taken", {
    p_tenant: params.tenant,
    p_portal: params.portal,
    p_employee_number: emp,
    p_exclude_profile_id: params.excludeProfileId,
  });

  if (error) return { error: error.message, taken: false };
  return { taken: data === true };
}
