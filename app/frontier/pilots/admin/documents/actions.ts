"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";

export async function uploadDocument(
  _prev: { error?: string; success?: string } | null,
  formData: FormData
) {
  const admin = await isAdmin();
  if (!admin) {
    return { error: "Admin access required" };
  }

  const file = formData.get("file") as File;
  const category = (formData.get("category") as string)?.trim() || "general";

  if (!file || file.size === 0) {
    return { error: "Please select a file" };
  }

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ];
  if (!allowedTypes.includes(file.type)) {
    return { error: "File type not allowed. Use PDF, Word, TXT, or CSV." };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { error: "File size must be under 50 MB" };
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${category}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from("documents").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("[Admin] Upload error:", error);
    return { error: error.message };
  }

  return { success: `Uploaded "${file.name}" to ${category}` };
}
