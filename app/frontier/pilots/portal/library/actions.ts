"use server";

import { createClient } from "@/lib/supabase/server";
import { canManageDocumentsByRole, isAdmin } from "@/lib/profile";

export type LibraryDocument = {
  path: string;
  name: string;
  category: string;
  displayName?: string;
  size?: number;
  updatedAt?: string;
};

export async function getIsAdmin(): Promise<boolean> {
  return isAdmin();
}

export async function listDocuments(): Promise<{ docs: LibraryDocument[]; error?: string }> {
  try {
    const supabase = await createClient();
    const allFiles: LibraryDocument[] = [];

    const scan = async (prefix: string) => {
      const { data } = await supabase.storage.from("documents").list(prefix, { limit: 500 });
      if (!data) return;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id != null) {
          const category = path.split("/")[0] ?? "general";
          const namePart = path.split("/").pop() ?? item.name;
          allFiles.push({
            path,
            name: namePart,
            category,
            size: item.metadata?.size,
            updatedAt: item.updated_at,
          });
        } else {
          await scan(path);
        }
      }
    };
    await scan("");

    if (allFiles.length > 0) {
      try {
        const { data: displayRows } = await supabase
          .from("document_display_names")
          .select("path, display_name")
          .in("path", allFiles.map((d) => d.path));
        const displayByPath = new Map((displayRows ?? []).map((r) => [r.path, r.display_name]));
        for (const d of allFiles) {
          const dn = displayByPath.get(d.path);
          if (dn) d.displayName = dn;
        }
      } catch {
        /* document_display_names may not exist before migration 012 */
      }
    }

    return { docs: allFiles };
  } catch (err) {
    return { docs: [], error: err instanceof Error ? err.message : "Failed to list documents" };
  }
}

export async function deleteDocument(path: string): Promise<{ error?: string }> {
  const allowed = await canManageDocumentsByRole();
  if (!allowed) return { error: "Admin access required" };
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from("documents").remove([path]);
    if (error) return { error: error.message };
    await supabase.from("document_chunks").delete().eq("source_path", path);
    await supabase.from("document_display_names").delete().eq("path", path);
    await supabase.from("document_ai_settings").delete().eq("path", path);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed" };
  }
}

export async function renameDocument(
  oldPath: string,
  newDisplayName: string
): Promise<{ error?: string }> {
  const allowed = await canManageDocumentsByRole();
  if (!allowed) return { error: "Admin access required" };
  if (!newDisplayName?.trim()) return { error: "Name is required" };
  const safe = newDisplayName.replace(/[^a-zA-Z0-9. \-]/g, "_").replace(/\s+/g, " ").trim();
  if (!safe) return { error: "Invalid name" };
  try {
    const supabase = await createClient();
    const parts = oldPath.split("/");
    const category = parts[0] ?? "general";
    const fileName = parts[parts.length - 1] ?? "";
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";
    const base = safe.endsWith(ext) ? safe : safe + (ext || "");
    const ts = parts[1]?.match(/^(\d+)_/)?.[1] ?? Date.now();
    const newPath = `${category}/${ts}_${category}_${base}`;
    if (newPath === oldPath) return {};
    const { error } = await supabase.storage.from("documents").move(oldPath, newPath);
    if (error) return { error: error.message };
    await supabase.from("document_chunks").delete().eq("source_path", oldPath);
    await supabase.from("document_display_names").delete().eq("path", oldPath);
    await supabase.from("document_display_names").upsert({
      path: newPath,
      display_name: newDisplayName.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "path" });
    const { data: aiRow } = await supabase.from("document_ai_settings").select("ai_enabled").eq("path", oldPath).single();
    if (aiRow) {
      await supabase.from("document_ai_settings").delete().eq("path", oldPath);
      await supabase.from("document_ai_settings").upsert({ path: newPath, ai_enabled: aiRow.ai_enabled });
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Rename failed" };
  }
}

export async function replaceDocument(
  path: string,
  formData: FormData
): Promise<{ error?: string }> {
  const canWrite = await canManageDocumentsByRole();
  if (!canWrite) return { error: "Admin access required" };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file" };
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ];
  if (!allowed.includes(file.type)) return { error: "File type not allowed" };
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from("documents").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Replace failed" };
  }
}

export async function getDocumentAIStatus(
  paths: string[]
): Promise<{
  statusByPath: Record<string, "active" | "not_enabled">;
  aiEnabledByPath: Record<string, boolean>;
}> {
  const statusByPath: Record<string, "active" | "not_enabled"> = {};
  const aiEnabledByPath: Record<string, boolean> = {};
  for (const p of paths) {
    statusByPath[p] = "not_enabled";
    aiEnabledByPath[p] = false;
  }
  if (paths.length === 0) return { statusByPath, aiEnabledByPath };
  try {
    const supabase = await createClient();
    const chunksRes = await supabase.from("document_chunks").select("source_path").in("source_path", paths);
    const indexed = new Set((chunksRes.data ?? []).map((r) => r.source_path).filter(Boolean));
    for (const p of paths) {
      if (indexed.has(p)) statusByPath[p] = "active";
    }
    try {
      const settingsRes = await supabase.from("document_ai_settings").select("path, ai_enabled").in("path", paths);
      for (const r of settingsRes.data ?? []) {
        if (r.path) aiEnabledByPath[r.path] = r.ai_enabled === true;
      }
    } catch {
      /* document_ai_settings may not exist before migration 011 */
    }
    return { statusByPath, aiEnabledByPath };
  } catch {
    return { statusByPath, aiEnabledByPath };
  }
}

export async function getDocumentDownloadUrl(path: string): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error) return { error: error.message };
    return { url: data.signedUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Download failed" };
  }
}
