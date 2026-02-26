"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";

export async function checkDuplicateDocument(
  category: string,
  fileName: string
): Promise<{ duplicate: boolean; error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { duplicate: false };
  try {
    const supabase = await createClient();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const logicalSuffix = `_${category}_${safeName}`;

    const scan = async (prefix: string): Promise<boolean> => {
      const { data } = await supabase.storage.from("documents").list(prefix, { limit: 500 });
      if (!data) return false;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id != null) {
          const cat = path.split("/")[0] ?? "";
          const fn = path.split("/").pop() ?? "";
          if (cat === category && /^\d+_/.test(fn) && fn.endsWith(logicalSuffix)) {
            return true;
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

  const { duplicate } = await checkDuplicateDocument(category, file.name);
  if (duplicate) {
    const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
    return { error: `This file already exists in ${displayCategory}. Use Replace in Library to update it.` };
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${category}/${Date.now()}_${category}_${safeName}`;

  const { error } = await supabase.storage.from("documents").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("[Admin] Upload error:", error);
    return { error: error.message };
  }

  const base = file.name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const withoutExt = base.includes(".") ? base.replace(/\.[^.]+$/, "") : base;
  const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
  return { success: `${withoutExt} added to ${displayCategory}.` };
}
