"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";

export type LibraryDocument = {
  path: string;
  name: string;
  category: string;
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

    return { docs: allFiles };
  } catch (err) {
    return { docs: [], error: err instanceof Error ? err.message : "Failed to list documents" };
  }
}

export async function deleteDocument(path: string): Promise<{ error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { error: "Admin access required" };
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from("documents").remove([path]);
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed" };
  }
}

export async function renameDocument(
  oldPath: string,
  newDisplayName: string
): Promise<{ error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { error: "Admin access required" };
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
    const newPath = `${category}/${ts}_${base}`;
    if (newPath === oldPath) return {};
    const { error } = await supabase.storage.from("documents").move(oldPath, newPath);
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Rename failed" };
  }
}

export async function replaceDocument(
  path: string,
  formData: FormData
): Promise<{ error?: string }> {
  const admin = await isAdmin();
  if (!admin) return { error: "Admin access required" };
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
