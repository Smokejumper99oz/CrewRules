import { createClient } from "@/lib/supabase/server";

async function linkMentorToAssignmentsLegacyExact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  empNum: string
): Promise<number> {
  const { data, error } = await supabase
    .from("mentor_assignments")
    .update({ mentor_user_id: userId })
    .is("mentor_user_id", null)
    .eq("mentor_employee_number", empNum)
    .select("id");

  if (error) return 0;
  return (data ?? []).length;
}

function rpcCount(data: unknown): number | null {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string" && data.trim() !== "") {
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Link staged mentor_assignments rows when `mentor_employee_number` matches the signed-in profile
 * (btrim + numeric equality for digit-only via RPC). Falls back to exact `.eq` if RPC is missing.
 */
export async function linkMentorToAssignments(
  userId: string,
  employeeNumber: string | null | undefined
): Promise<number> {
  const empNum = employeeNumber?.trim();
  if (!empNum) return 0;

  const supabase = await createClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "link_mentor_assignments_for_authenticated_user"
  );

  const fromRpc = rpcCount(rpcData);
  if (!rpcError && fromRpc !== null) {
    return fromRpc;
  }

  if (rpcError) {
    console.warn(
      "[linkMentorToAssignments] RPC link_mentor_assignments_for_authenticated_user failed; using exact match fallback:",
      rpcError.message
    );
  }

  return linkMentorToAssignmentsLegacyExact(supabase, userId, empNum);
}
