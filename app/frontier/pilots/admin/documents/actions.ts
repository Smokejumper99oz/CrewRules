"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";
import { sanitizeDisplayNameForPath } from "@/lib/document-utils";

export async function checkDuplicateDocument(
  category: string,
  fileName: string,
  displayName?: string
): Promise<{ duplicate: boolean; error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { duplicate: false };
  try {
    const supabase = await createClient();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const logicalSuffix = `_${category}_${safeName}`;
    const displaySuffix = displayName
      ? `_${category}_${sanitizeDisplayNameForPath(displayName)}`
      : null;

    const scan = async (prefix: string): Promise<boolean> => {
      const { data } = await supabase.storage.from("documents").list(prefix, { limit: 500 });
      if (!data) return false;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id != null) {
          const cat = path.split("/")[0] ?? "";
          const fn = path.split("/").pop() ?? "";
          if (cat === category && /^\d+_/.test(fn)) {
            const fnAfterTs = fn.replace(/^\d+_/, "");
            if (displaySuffix && fnAfterTs.toLowerCase().startsWith(displaySuffix.toLowerCase().slice(1))) {
              return true;
            }
            if (fn.endsWith(logicalSuffix)) return true;
          }
        } else {
          if (await scan(path)) return true;
        }
      }
      return false;
    };
    const duplicate = await scan("");
    return { duplicate };
  } catch (err) {
    return { duplicate: false, error: err instanceof Error ? err.message : "Check failed" };
  }
}

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
  const fileDisplayName = (formData.get("file_name") as string)?.trim();

  if (!file || file.size === 0) {
    return { error: "Please select a file" };
  }
  if (!fileDisplayName) {
    return { error: "File name is required" };
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

  const { duplicate } = await checkDuplicateDocument(category, file.name, fileDisplayName);
  if (duplicate) {
    const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
    return { error: `A document named "${fileDisplayName}" already exists in ${displayCategory}. Use Replace in Library to update it.` };
  }

  const supabase = await createClient();
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  const safeName = sanitizeDisplayNameForPath(fileDisplayName) + ext;
  const path = `${category}/${Date.now()}_${category}_${safeName}`;

  const { error } = await supabase.storage.from("documents").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("[Admin] Upload error:", error);
    return { error: error.message };
  }

  await setDocumentDisplayName(path, fileDisplayName);
  const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
  return { success: `${fileDisplayName} added to ${displayCategory}.` };
}

export async function setDocumentDisplayName(path: string, displayName: string): Promise<{ error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { error: "Admin access required" };
  if (!displayName?.trim()) return { error: "Display name is required" };
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("document_display_names")
      .upsert({ path, display_name: displayName.trim(), updated_at: new Date().toISOString() }, { onConflict: "path" });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save display name" };
  }
}

export async function setDocumentAISetting(
  path: string,
  aiEnabled: boolean
): Promise<{ error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { error: "Admin access required" };
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("document_ai_settings")
      .upsert({ path, ai_enabled: aiEnabled, updated_at: new Date().toISOString() }, { onConflict: "path" });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update setting" };
  }
}
