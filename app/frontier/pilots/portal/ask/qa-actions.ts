"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, isProActive } from "@/lib/profile";

const RECENT_LIMIT = 30;

export type QAItem = {
  id: string;
  question: string;
  answer: string | null;
  citation: string | null;
  citation_path: string | null;
  archived: boolean;
  created_at: string;
};

export async function saveQARow(
  question: string,
  answer: string | null,
  citation: string | null,
  citationPath: string | null
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile || !isProActive(profile)) return {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { error: insertError } = await supabase.from("ask_qa").insert({
    user_id: user.id,
    tenant: profile.tenant,
    portal: profile.portal,
    question,
    answer,
    citation,
    citation_path: citationPath,
    archived: false,
  });

  if (insertError) return { error: insertError.message };

  const { data: recent } = await supabase
    .from("ask_qa")
    .select("id")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (recent && recent.length > RECENT_LIMIT) {
    const toArchive = recent.slice(RECENT_LIMIT).map((r) => r.id);
    await supabase.from("ask_qa").update({ archived: true }).in("id", toArchive);
  }

  return {};
}

export async function listRecentQA(): Promise<{ items: QAItem[]; error?: string }> {
  const profile = await getProfile();
  if (!profile || !isProActive(profile)) {
    return { items: [] };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [] };

  const { data, error } = await supabase
    .from("ask_qa")
    .select("id, question, answer, citation, citation_path, archived, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);

  if (error) return { items: [], error: error.message };
  return { items: (data ?? []) as QAItem[] };
}

const ARCHIVE_PAGE_SIZE = 20;

export async function listArchiveQA(page = 1): Promise<{
  items: QAItem[];
  total: number;
  hasMore: boolean;
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile || !isProActive(profile)) {
    return { items: [], total: 0, hasMore: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], total: 0, hasMore: false };

  const from = (page - 1) * ARCHIVE_PAGE_SIZE;
  const to = from + ARCHIVE_PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from("ask_qa")
    .select("id, question, answer, citation, citation_path, archived, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .eq("archived", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { items: [], total: 0, hasMore: false, error: error.message };

  const total = count ?? 0;
  return {
    items: (data ?? []) as QAItem[],
    total,
    hasMore: from + (data?.length ?? 0) < total,
  };
}

export async function hasQAPersistencePlan(): Promise<boolean> {
  const profile = await getProfile();
  return isProActive(profile);
}
